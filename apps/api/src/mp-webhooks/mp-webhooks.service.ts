/**
 * @file mp-webhooks.service.ts
 * @description Servicio de procesamiento de webhooks de pago de Mercado Pago.
 *
 * **Flujo completo:**
 * 1. Activa el contexto RLS via `db.als.run({ tenantId }, ...)`.
 * 2. Lee el `access_token` encriptado de `tenant_mp_credentials`.
 * 3. Desencripta el token y consulta la API de MP para obtener detalles del pago.
 * 4. Persiste el resultado en `mp_transactions` con UPSERT SQL nativo.
 * 5. Si el pago tiene `external_reference` (orderId), llama a OrdersService
 *    para actualizar el estado de la orden y disparar notificaciones de email.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DbService } from '../db/db.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { decrypt } from '../utils/crypto.util.js';

/** Estructura de las credenciales de MP almacenadas en la DB. */
interface TenantMpCredentialRow {
  access_token_encrypted: string;
}

/** Respuesta parcial de la API de pagos de Mercado Pago. */
interface MpPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  payer: {
    email: string | null;
  };
}

@Injectable()
export class MpWebhooksService {
  private readonly logger = new Logger(MpWebhooksService.name);

  /** Base URL de la API de pagos de Mercado Pago. */
  private readonly MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';

  constructor(
    private readonly db: DbService,
    private readonly http: HttpService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Procesa un webhook de pago de Mercado Pago para un tenant específico.
   *
   * @param tenantId  - UUID del tenant propietario del pago.
   * @param paymentId - ID del pago en Mercado Pago.
   */
  async processPaymentWebhook(tenantId: string, paymentId: string): Promise<void> {
    await this.db.als.run({ tenantId }, async () => {
      this.logger.log(
        `[Tenant: ${tenantId}] Procesando pago MP ID: ${paymentId}`,
      );

      // ── 1. Obtener el access_token encriptado del tenant ──────────────────
      const credResult = await this.db.query<TenantMpCredentialRow>(
        'SELECT access_token_encrypted FROM tenant_mp_credentials LIMIT 1',
      );

      if (credResult.rows.length === 0) {
        this.logger.warn(
          `[Tenant: ${tenantId}] No se encontraron credenciales de Mercado Pago. ` +
            `Webhook de pago ${paymentId} ignorado.`,
        );
        return;
      }

      // ── 2. Desencriptar el access_token ───────────────────────────────────
      let accessToken: string;
      try {
        accessToken = decrypt(credResult.rows[0].access_token_encrypted);
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(
          `[Tenant: ${tenantId}] Error al desencriptar el access_token: ${error.message}`,
        );
        throw new Error(
          `Fallo al desencriptar credenciales para el tenant ${tenantId}.`,
        );
      }

      // ── 3. Consultar la API de pagos de Mercado Pago ──────────────────────
      let paymentData: MpPaymentResponse;
      try {
        const response = await firstValueFrom(
          this.http.get<MpPaymentResponse>(
            `${this.MP_PAYMENTS_URL}/${paymentId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        paymentData = response.data;
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
          `[Tenant: ${tenantId}] Error al consultar pago ${paymentId} en MP API. ` +
            `Status: ${error?.response?.status ?? 'N/A'}. Mensaje: ${mpMsg}`,
        );
        throw new Error(`Fallo al consultar el pago ${paymentId} en Mercado Pago.`);
      }

      // ── 4. Extraer los campos relevantes del pago ─────────────────────────
      const {
        id: mpPaymentId,
        status,
        status_detail: statusDetail,
        transaction_amount: amount,
        currency_id: currencyId,
        external_reference: orderId,
        payer,
      } = paymentData;

      const payerEmail = payer?.email ?? null;

      this.logger.log(
        `[Tenant: ${tenantId}] Pago ${mpPaymentId} obtenido de MP. ` +
          `Status: ${status} (${statusDetail}). Monto: ${amount} ${currencyId}. ` +
          `external_reference (orderId): ${orderId ?? 'N/A'}`,
      );

      // ── 5. UPSERT en mp_transactions (SQL puro, sin ORM) ──────────────────
      await this.db.query(
        `INSERT INTO mp_transactions (
          tenant_id,
          mp_payment_id,
          status,
          status_detail,
          amount,
          currency_id,
          payer_email,
          order_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (mp_payment_id) DO UPDATE SET
          status        = EXCLUDED.status,
          status_detail = EXCLUDED.status_detail,
          amount        = EXCLUDED.amount,
          currency_id   = EXCLUDED.currency_id,
          payer_email   = EXCLUDED.payer_email,
          order_id      = EXCLUDED.order_id`,
        [
          tenantId,
          String(mpPaymentId),
          status,
          statusDetail,
          amount,
          currencyId,
          payerEmail,
          orderId ?? null,
        ],
      );

      this.logger.log(
        `[Tenant: ${tenantId}] Pago ${mpPaymentId} persistido en mp_transactions correctamente.`,
      );

      // ── 6. Actualizar el estado de la orden (si existe external_reference) ─
      // El external_reference es el UUID de la orden (creado en OrdersService.createOrder).
      if (orderId) {
        try {
          // Mapeamos el estado de MP a los valores internos
          const statusMap: Record<string, string> = {
            approved: 'approved',
            rejected: 'rejected',
            refunded: 'refunded',
          };
          const mappedStatus = statusMap[status] ?? 'pending';

          await this.ordersService.updatePaymentStatus(
            orderId,
            mappedStatus,
            String(mpPaymentId),
          );

          this.logger.log(
            `[Tenant: ${tenantId}] Orden ${orderId} actualizada a payment_status="${mappedStatus}" ` +
              `con mp_transaction_id="${mpPaymentId}".`,
          );
        } catch (err: unknown) {
          const error = err as Error;
          this.logger.error(
            `[Tenant: ${tenantId}] Error al actualizar la orden ${orderId}: ${error.message}`,
          );
        }
      }
    });
  }
}
