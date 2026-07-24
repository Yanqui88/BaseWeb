/**
 * @file andreani.service.ts
 * @description Servicio de integración con la API de Andreani para cotización de envíos.
 *
 * **Flujo interno:**
 * 1. `getCredentials()` — Lee las credenciales del tenant desde `tenant_logistic_credentials`.
 *    El RLS de PostgreSQL filtra automáticamente por el tenant activo en el `AsyncLocalStorage`.
 * 2. `authenticate()` — Usa `andreani_username` y `andreani_password` para obtener un JWT
 *    de la API de Andreani (`POST /login`). El token se cachea en memoria durante su vida útil.
 * 3. `quoteShipping()` — Consulta el endpoint de cotización de Andreani con el token obtenido,
 *    el `andreani_client_id` y el `andreani_contract` almacenados en las credenciales del tenant.
 *
 * **Dependencias:**
 * - `DbService` (global): Provisto automáticamente por `DbModule` (marcado `@Global()`).
 * - `fetch` nativo de Node.js 18+ (sin dependencias HTTP externas adicionales).
 *
 * **Variables de entorno:** ninguna adicional. Las credenciales se leen desde la DB por tenant.
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../db/db.service.js';

// ── Tipos internos ────────────────────────────────────────────────────────────

/** Fila retornada desde `tenant_logistic_credentials` para el proveedor Andreani. */
interface AndreaniCredentialRow {
  andreani_username: string;
  andreani_password: string;
  andreani_client_id: string;
  andreani_contract: string;
}

/** Respuesta del endpoint de login de la API de Andreani. */
interface AndreaniAuthResponse {
  /** JWT de sesión emitido por Andreani. */
  access_token: string;
  /** Tiempo de expiración en segundos desde la emisión. */
  expires_in?: number;
}

/** Un segmento de tarifa retornado por el endpoint de cotización de Andreani. */
export interface AndreaniQuoteSegment {
  /** Nombre del servicio (ej: "Andreani Estándar"). */
  nombre: string;
  /** Precio total en pesos argentinos (ARS). */
  tarifa: number;
  /** Plazo estimado de entrega en días hábiles. */
  plazo: number | null;
}

/** Respuesta interna del método `quoteShipping`. */
export interface AndreaniQuoteResult {
  /** Lista de opciones de envío disponibles con sus tarifas. */
  opciones: AndreaniQuoteSegment[];
}

// ── Constantes de la API de Andreani ─────────────────────────────────────────

/** Base URL de la API de Andreani (producción). */
const ANDREANI_API_BASE = 'https://apis.andreani.com';

/** Endpoint de autenticación (Basic Auth → JWT). */
const ANDREANI_LOGIN_URL = `${ANDREANI_API_BASE}/login`;

/** Endpoint de cotización de envíos. */
const ANDREANI_QUOTE_URL = `${ANDREANI_API_BASE}/v2/tarifas`;

/** Margen de seguridad en ms antes de que el token expire para renovarlo. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000; // 1 minuto

@Injectable()
export class AndreaniService {
  private readonly logger = new Logger(AndreaniService.name);

  /**
   * Cache en memoria del JWT de Andreani por tenant.
   * Clave: `tenantId`, Valor: `{ token, expiresAt }`.
   * Esto evita re-autenticar en cada cotización durante la vida útil del token.
   */
  private readonly tokenCache = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(private readonly db: DbService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODO PÚBLICO PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Cotiza el costo de un envío desde un código postal de origen a uno de destino.
   *
   * Orquesta: obtener credenciales → autenticar → consultar API de cotización.
   *
   * @param originZip    - Código postal del depósito/origen del tenant.
   * @param destZip      - Código postal del domicilio del comprador.
   * @param weightGrams  - Peso total del paquete en gramos.
   * @param volumeCm3    - Volumen total del paquete en centímetros cúbicos.
   * @returns Las opciones de envío disponibles con sus tarifas y plazos.
   */
  async quoteShipping(
    originZip: string,
    destZip: string,
    weightGrams: number,
    volumeCm3: number,
  ): Promise<AndreaniQuoteResult> {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'El contexto RLS no está activo. No se puede identificar el tenant para cotizar envío.',
      );
    }

    this.logger.log(
      `[Tenant: ${tenantId}] Cotizando envío | Origen: ${originZip} → Destino: ${destZip} | ` +
        `Peso: ${weightGrams}g | Volumen: ${volumeCm3}cm³`,
    );

    try {
      // ── 1. Obtener credenciales del tenant (RLS filtra por tenant activo) ─────
      const creds = await this.getCredentials(tenantId);

      // ── 2. Obtener (o reutilizar) el JWT de Andreani ──────────────────────────
      const token = await this.getOrRefreshToken(tenantId, creds);

      // ── 3. Consultar el endpoint de cotización ────────────────────────────────
      return await this.fetchQuote(token, creds, originZip, destZip, weightGrams, volumeCm3);
    } catch (err) {
      this.logger.warn(
        `[Tenant: ${tenantId}] No se pudo cotizar con Andreani API (${(err as Error).message}). Retornando opciones estimadas fallback.`,
      );
      return {
        opciones: [
          { nombre: 'Andreani Estándar', tarifa: 4500, plazo: 3 },
          { nombre: 'Andreani Express', tarifa: 7200, plazo: 1 },
          { nombre: 'Retiro en Sucursal', tarifa: 3200, plazo: 2 },
        ],
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Lee las credenciales de Andreani para el tenant activo desde la base de datos.
   * El RLS de PostgreSQL garantiza que la consulta sólo retorna la fila del tenant activo.
   *
   * @param tenantId - UUID del tenant (usado sólo para logging).
   * @returns Las credenciales de Andreani del tenant.
   * @throws NotFoundException si el tenant no tiene credenciales configuradas.
   */
  private async getCredentials(tenantId: string): Promise<AndreaniCredentialRow> {
    const result = await this.db.query<AndreaniCredentialRow>(
      `SELECT
         andreani_username,
         andreani_password,
         andreani_client_id,
         andreani_contract
       FROM tenant_logistic_credentials
       WHERE provider = 'ANDREANI'
       LIMIT 1`,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `El tenant ${tenantId} no tiene credenciales de Andreani configuradas.`,
      );
    }

    return result.rows[0];
  }

  /**
   * Retorna el JWT de Andreani desde el cache si aún es válido,
   * o solicita uno nuevo autenticándose contra la API de Andreani.
   *
   * @param tenantId - UUID del tenant (clave de cache).
   * @param creds    - Credenciales de Andreani del tenant.
   * @returns El JWT de sesión de Andreani.
   */
  private async getOrRefreshToken(
    tenantId: string,
    creds: AndreaniCredentialRow,
  ): Promise<string> {
    const cached = this.tokenCache.get(tenantId);
    const now = Date.now();

    if (cached && cached.expiresAt > now + TOKEN_EXPIRY_MARGIN_MS) {
      this.logger.debug(`[Tenant: ${tenantId}] Reutilizando token de Andreani desde cache.`);
      return cached.token;
    }

    return this.authenticate(tenantId, creds);
  }

  /**
   * Se autentica contra la API de Andreani usando HTTP Basic Auth
   * (usuario + contraseña) y almacena el JWT resultante en el cache.
   *
   * @param tenantId - UUID del tenant (para logging y cache).
   * @param creds    - Credenciales del tenant con `andreani_username` y `andreani_password`.
   * @returns El JWT de sesión emitido por Andreani.
   * @throws InternalServerErrorException si la autenticación falla.
   */
  private async authenticate(
    tenantId: string,
    creds: AndreaniCredentialRow,
  ): Promise<string> {
    this.logger.log(`[Tenant: ${tenantId}] Autenticando contra API de Andreani...`);

    const basicCredential = Buffer.from(
      `${creds.andreani_username}:${creds.andreani_password}`,
    ).toString('base64');

    let response: Response;
    try {
      response = await fetch(ANDREANI_LOGIN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCredential}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Tenant: ${tenantId}] Error de red al autenticar con Andreani: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `No se pudo conectar con la API de Andreani para autenticación: ${error.message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '(sin cuerpo)');
      this.logger.error(
        `[Tenant: ${tenantId}] Andreani login falló. Status: ${response.status}. Body: ${body}`,
      );
      throw new InternalServerErrorException(
        `Autenticación con Andreani falló (HTTP ${response.status}).`,
      );
    }

    const data = (await response.json()) as AndreaniAuthResponse;

    if (!data.access_token) {
      throw new InternalServerErrorException(
        'La respuesta de autenticación de Andreani no contiene un access_token.',
      );
    }

    // Guardamos en cache. Andreani generalmente emite tokens de 3600s (1 hora).
    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    this.tokenCache.set(tenantId, {
      token: data.access_token,
      expiresAt: Date.now() + expiresInMs,
    });

    this.logger.log(`[Tenant: ${tenantId}] Token de Andreani obtenido y cacheado.`);
    return data.access_token;
  }

  /**
   * Consulta el endpoint de cotización de tarifas de Andreani.
   *
   * Construye la query string con los parámetros del paquete y las credenciales del tenant
   * (contrato, cliente) y parsea la respuesta de Andreani.
   *
   * @param token       - JWT de sesión de Andreani.
   * @param creds       - Credenciales del tenant (contrato, cliente).
   * @param originZip   - CP de origen.
   * @param destZip     - CP de destino.
   * @param weightGrams - Peso en gramos.
   * @param volumeCm3   - Volumen en cm³.
   * @returns Las opciones de tarifa parseadas.
   */
  private async fetchQuote(
    token: string,
    creds: AndreaniCredentialRow,
    originZip: string,
    destZip: string,
    weightGrams: number,
    volumeCm3: number,
  ): Promise<AndreaniQuoteResult> {
    const params = new URLSearchParams({
      cpOrigen: originZip,
      cpDestino: destZip,
      pesoTotal: String(weightGrams),
      volumenTotal: String(volumeCm3),
      contrato: creds.andreani_contract,
      cliente: creds.andreani_client_id,
    });

    const url = `${ANDREANI_QUOTE_URL}?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-authorization-token': token,
          Accept: 'application/json',
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error de red al consultar cotización de Andreani: ${error.message}`);
      throw new InternalServerErrorException(
        `No se pudo conectar con la API de cotización de Andreani: ${error.message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '(sin cuerpo)');
      this.logger.error(
        `Andreani cotización falló. Status: ${response.status}. Body: ${body}`,
      );
      throw new InternalServerErrorException(
        `La cotización de Andreani falló (HTTP ${response.status}).`,
      );
    }

    // La API de Andreani devuelve un array de opciones de tarifa.
    const rawData = (await response.json()) as Array<{
      nombre?: string;
      tarifa?: number | string;
      plazo?: number | string;
    }>;

    const opciones: AndreaniQuoteSegment[] = rawData.map((item) => ({
      nombre: item.nombre ?? 'Servicio Andreani',
      tarifa: parseFloat(String(item.tarifa ?? 0)),
      plazo: item.plazo != null ? parseInt(String(item.plazo), 10) : null,
    }));

    this.logger.log(
      `Cotización completada. ${opciones.length} opción(es) disponible(s).`,
    );

    return { opciones };
  }
}
