/**
 * @file mp-auth.service.ts
 * @description Servicio de negocio para la integración OAuth de Mercado Pago.
 *
 * Implementa el flujo completo de vinculación de cuenta:
 * 1. Intercambio del código de autorización por tokens de acceso (MP OAuth).
 * 2. Encriptación de los tokens sensibles antes de persistirlos.
 * 3. UPSERT atómico en `tenant_mp_credentials` (SQL puro, sin ORM).
 *
 * **Seguridad por capas:**
 * - Los tokens `access_token` y `refresh_token` se cifran con AES-256-GCM
 *   antes de ser almacenados en la base de datos.
 * - El RLS de PostgreSQL, activado por el `TenantInterceptor` o el `JwtAdminGuard`
 *   via `AsyncLocalStorage`, garantiza que el UPSERT solo afecte las filas del
 *   tenant autorizado.
 *
 * **Variables de entorno requeridas:**
 * - `MP_CLIENT_ID`       : App ID de la aplicación de Mercado Pago.
 * - `MP_CLIENT_SECRET`   : Secret de la aplicación de Mercado Pago.
 * - `MP_ENCRYPTION_KEY`  : Clave AES-256 en hex (32 bytes = 64 chars hex).
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DbService } from '../db/db.service.js';
import { encrypt } from '../utils/crypto.util.js';

/** Respuesta esperada del endpoint de token de Mercado Pago. */
interface MpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

/** Resultado que retorna el método `linkAccount`. */
export interface LinkAccountResult {
  success: boolean;
  mp_user_id: number;
}

@Injectable()
export class MpAuthService {
  private readonly logger = new Logger(MpAuthService.name);

  /** Endpoint oficial de OAuth de Mercado Pago para intercambio de tokens. */
  private readonly MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';

  constructor(
    private readonly http: HttpService,
    private readonly db: DbService,
  ) {}

  /**
   * Vincula la cuenta de Mercado Pago de un tenant intercambiando el código OAuth.
   *
   * @param tenantId    - UUID del tenant que está vinculando su cuenta de MP.
   * @param code        - Código de autorización recibido de Mercado Pago (uso único).
   * @param redirectUri - URI de redirección usada al solicitar la autorización.
   * @returns Objeto con `success: true` y el `mp_user_id` del vendedor vinculado.
   * @throws UnprocessableEntityException si Mercado Pago rechaza el código.
   * @throws InternalServerErrorException si falla la persistencia en la DB.
   */
  async linkAccount(
    tenantId: string,
    code: string,
    redirectUri: string,
  ): Promise<LinkAccountResult> {
    // ── 1. Intercambio del código OAuth por tokens de acceso ───────────────
    this.logger.log(`[Tenant: ${tenantId}] Iniciando intercambio OAuth con Mercado Pago.`);

    let mpTokenData: MpTokenResponse;

    try {
      const response = await firstValueFrom(
        this.http.post<MpTokenResponse>(
          this.MP_TOKEN_URL,
          {
            client_secret: process.env.MP_CLIENT_SECRET,
            client_id: process.env.MP_CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      mpTokenData = response.data;
    } catch (error: unknown) {
      // Extraemos el mensaje de error de la respuesta de MP si está disponible.
      const axiosError = error as {
        response?: { data?: { message?: string; error?: string }; status?: number };
        message?: string;
      };

      const mpErrorMessage =
        axiosError?.response?.data?.message ||
        axiosError?.response?.data?.error ||
        axiosError?.message ||
        'Error desconocido al comunicarse con Mercado Pago.';

      const mpStatus = axiosError?.response?.status;

      this.logger.error(
        `[Tenant: ${tenantId}] Error al intercambiar código OAuth con MP. ` +
          `Status: ${mpStatus}. Mensaje: ${mpErrorMessage}`,
      );

      throw new UnprocessableEntityException(
        `Mercado Pago rechazó el código de autorización: ${mpErrorMessage}`,
      );
    }

    const { access_token, refresh_token, public_key, user_id } = mpTokenData;

    this.logger.log(
      `[Tenant: ${tenantId}] Tokens de MP obtenidos correctamente. MP User ID: ${user_id}.`,
    );

    // ── 2. Encriptación de los tokens sensibles ────────────────────────────
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;

    try {
      encryptedAccessToken = encrypt(access_token);
      encryptedRefreshToken = encrypt(refresh_token);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `[Tenant: ${tenantId}] Error al encriptar tokens de MP: ${err.message}`,
      );
      throw new InternalServerErrorException(
        'Error interno al procesar los tokens de Mercado Pago.',
      );
    }

    // ── 3. UPSERT en tenant_mp_credentials usando SQL puro ────────────────
    // El RLS de PostgreSQL, activado por el contexto ALS (TenantInterceptor o
    // el guard JWT), garantiza que solo se modifiquen las filas del tenant activo.
    // Usamos `db.als.run()` con tenantId para asegurar que RLS esté activo
    // incluso en llamadas directas al servicio sin interceptor de ruta.
    try {
      await this.db.als.run({ tenantId }, async () => {
        await this.db.query(
          `INSERT INTO tenant_mp_credentials (
            tenant_id,
            mp_user_id,
            access_token_encrypted,
            refresh_token_encrypted,
            public_key,
            linked_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (tenant_id)
          DO UPDATE SET
            mp_user_id               = EXCLUDED.mp_user_id,
            access_token_encrypted   = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted  = EXCLUDED.refresh_token_encrypted,
            public_key               = EXCLUDED.public_key,
            linked_at                = NOW()`,
          [
            tenantId,
            user_id,
            encryptedAccessToken,
            encryptedRefreshToken,
            public_key,
          ],
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `[Tenant: ${tenantId}] Error al persistir credenciales de MP en la DB: ${err.message}`,
      );
      throw new InternalServerErrorException(
        'Error interno al guardar las credenciales de Mercado Pago.',
      );
    }

    this.logger.log(
      `[Tenant: ${tenantId}] Credenciales de MP guardadas exitosamente en la DB.`,
    );

    return { success: true, mp_user_id: user_id };
  }
}
