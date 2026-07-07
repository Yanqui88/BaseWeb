/**
 * @file checkout.service.ts
 * @description Servicio de negocio para la creación de preferencias de pago en Mercado Pago.
 *
 * **Flujo completo:**
 * 1. Lee el `tenantId` activo desde el `AsyncLocalStorage` (inyectado por `PublicTenantInterceptor`).
 * 2. Consulta la tabla `tenant_mp_credentials` para obtener el `access_token` encriptado del tenant.
 *    El RLS de PostgreSQL filtra automáticamente por el tenant activo.
 * 3. Desencripta el token con AES-256-GCM usando la función `decrypt` de `crypto.util.ts`.
 * 4. Realiza un HTTP POST a `https://api.mercadopago.com/checkout/preferences` con el payload
 *    armado con los items del carrito y los datos del comprador.
 * 5. Extrae y devuelve el `init_point` de la respuesta de Mercado Pago.
 *
 * **Variables de entorno requeridas:**
 * - `MP_ENCRYPTION_KEY`: Clave AES-256 en hexadecimal (64 chars) para desencriptar el token.
 * - `API_BASE_URL` (opcional): URL base de esta API para la `notification_url` de MP webhooks.
 *   Si no está definida, se usará un valor de fallback genérico.
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { DbService } from '../db/db.service.js';
import { decrypt } from '../utils/crypto.util.js';
import type { CheckoutCustomer, CheckoutItem } from './checkout.controller.js';

/** Fila retornada por la consulta de credenciales de MP. */
interface TenantMpCredentialRow {
  access_token_encrypted: string;
}

/** Ítem con el formato requerido por la API de Mercado Pago. */
interface MpItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

/** Payload enviado a `POST /checkout/preferences` de Mercado Pago. */
interface MpPreferencePayload {
  items: MpItem[];
  payer: { email: string };
  external_reference: string;
  notification_url: string;
}

/** Respuesta parcial de la API de preferencias de Mercado Pago. */
interface MpPreferenceResponse {
  /** ID único de la preferencia creada. */
  id: string;
  /** URL del checkout de MP a la que se redirige al comprador. */
  init_point: string;
  /** URL alternativa para entornos sandbox. */
  sandbox_init_point?: string;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  /** URL base de la API de preferencias de Mercado Pago. */
  private readonly MP_PREFERENCES_URL =
    'https://api.mercadopago.com/checkout/preferences';

  constructor(
    private readonly db: DbService,
    private readonly http: HttpService,
  ) {}

  /**
   * Crea una preferencia de pago en Mercado Pago para el tenant activo.
   *
   * El `tenantId` se obtiene del `AsyncLocalStorage` —no se recibe como parámetro—
   * porque el `PublicTenantInterceptor` ya lo habrá inyectado en el contexto RLS
   * antes de que este método sea invocado.
   *
   * @param items    - Array de items del carrito de compras del cliente.
   * @param customer - Datos del comprador (se requiere al menos el email).
   * @returns La URL `init_point` de Mercado Pago para redirigir al comprador al checkout.
   * @throws NotFoundException si el tenant no tiene credenciales de MP configuradas.
   * @throws InternalServerErrorException si la desencriptación o la llamada a MP fallan.
   */
  async createPreference(
    items: CheckoutItem[],
    customer: CheckoutCustomer,
  ): Promise<string> {
    // ── 1. Leer el tenantId desde el AsyncLocalStorage ────────────────────────
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'El contexto RLS no está activo. Asegúrate de que PublicTenantInterceptor esté configurado.',
      );
    }

    this.logger.log(
      `[Tenant: ${tenantId}] Creando preferencia de pago para ${items.length} ítem(s).`,
    );

    // ── 2. Obtener el access_token encriptado del tenant ──────────────────────
    // El RLS garantiza que el SELECT solo retorna la fila del tenant activo.
    const credResult = await this.db.query<TenantMpCredentialRow>(
      'SELECT access_token_encrypted FROM tenant_mp_credentials LIMIT 1',
    );

    if (credResult.rows.length === 0) {
      throw new NotFoundException(
        `El tenant ${tenantId} no tiene credenciales de Mercado Pago configuradas.`,
      );
    }

    // ── 3. Desencriptar el access_token ──────────────────────────────────────
    let accessToken: string;
    try {
      accessToken = decrypt(credResult.rows[0].access_token_encrypted);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Tenant: ${tenantId}] Error al desencriptar el access_token: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Fallo al desencriptar las credenciales para el tenant ${tenantId}.`,
      );
    }

    // ── 4. Armar el payload para Mercado Pago ─────────────────────────────────
    // Generamos un UUID como referencia externa temporal del pedido.
    const orderId = randomUUID();

    // La notification_url apunta al endpoint de webhooks de esta misma API.
    // Se lee desde una variable de entorno para soporte multi-entorno (local / staging / prod).
    const apiBaseUrl =
      process.env.API_BASE_URL ?? 'https://tu-api.com';
    const notificationUrl = `${apiBaseUrl}/mp-webhooks/${tenantId}`;

    const payload: MpPreferencePayload = {
      items: items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      payer: {
        email: customer.email,
      },
      external_reference: orderId,
      notification_url: notificationUrl,
    };

    // ── 5. Llamar a la API de preferencias de Mercado Pago ────────────────────
    let mpResponse: MpPreferenceResponse;
    try {
      const response = await firstValueFrom(
        this.http.post<MpPreferenceResponse>(
          this.MP_PREFERENCES_URL,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      mpResponse = response.data;
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };
      const mpMsg =
        error?.response?.data?.message ??
        error?.message ??
        'Error desconocido';
      this.logger.error(
        `[Tenant: ${tenantId}] Error al crear preferencia en MP API. ` +
          `Status: ${error?.response?.status ?? 'N/A'}. Mensaje: ${mpMsg}`,
      );
      throw new InternalServerErrorException(
        `Fallo al crear la preferencia de pago en Mercado Pago: ${mpMsg}`,
      );
    }

    this.logger.log(
      `[Tenant: ${tenantId}] Preferencia de pago creada. ` +
        `MP Preference ID: ${mpResponse.id}. Order ID: ${orderId}.`,
    );

    // ── 6. Retornar el init_point al controlador ──────────────────────────────
    return mpResponse.init_point;
  }
}
