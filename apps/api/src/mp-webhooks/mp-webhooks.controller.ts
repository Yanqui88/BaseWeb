/**
 * @file mp-webhooks.controller.ts
 * @description Controlador para recibir notificaciones IPN/webhook de Mercado Pago.
 *
 * **Endpoint:** `POST /mp-webhooks/:tenantId`
 *
 * Este endpoint es PÚBLICO (no requiere JWT) ya que Mercado Pago lo llama
 * directamente. La seguridad se garantiza por:
 * - El aislamiento de datos vía RLS con el `tenantId` en la URL.
 * - La consulta a la API oficial de MP para validar el pago real.
 *
 * **Comportamiento:** Devuelve `200 OK` inmediatamente para evitar que MP
 * reintente la notificación. El procesamiento real es asíncrono (fire-and-forget).
 *
 * **Tipos de notificaciones soportadas:**
 * - `topic: "payment"` (IPN legacy)
 * - `type: "payment"` (Webhooks modernos)
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MpWebhooksService } from './mp-webhooks.service.js';

/** Estructura laxa del body de una notificación de Mercado Pago. */
interface MpWebhookPayload {
  /** Tipo de evento (webhooks modernos). Ej: "payment" */
  type?: string;
  /** Tópico del evento (IPN legacy). Ej: "payment" */
  topic?: string;
  /** Objeto de datos con el ID del recurso notificado. */
  data?: {
    id?: string | number;
  };
  /** ID del recurso (IPN legacy). */
  id?: string | number;
}

/** Los webhooks de MP vienen de servidores externos. No aplicar rate limiting. */
@SkipThrottle()
@Controller('mp-webhooks')
export class MpWebhooksController {
  private readonly logger = new Logger(MpWebhooksController.name);

  constructor(private readonly mpWebhooksService: MpWebhooksService) {}

  /**
   * Recibe las notificaciones de pago de Mercado Pago.
   *
   * Devuelve `200 OK` inmediatamente y delega el procesamiento al servicio
   * de forma asíncrona para no bloquear el re-intento de MP.
   *
   * @param tenantId  - UUID del tenant obtenido de la URL.
   * @param body      - Payload del webhook enviado por Mercado Pago.
   */
  @Post(':tenantId')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() body: MpWebhookPayload,
  ): { received: boolean } {
    // Extraer el tipo de evento (soporta tanto IPN legacy como webhooks modernos)
    const eventType = body?.type ?? body?.topic;

    // Extraer el payment ID (puede venir en data.id o directamente en id)
    const rawPaymentId = body?.data?.id ?? body?.id;
    const paymentId = rawPaymentId != null ? String(rawPaymentId) : null;

    this.logger.log(
      `[Tenant: ${tenantId}] Webhook recibido. Tipo: ${eventType ?? 'desconocido'}, PaymentId: ${paymentId ?? 'N/A'}`,
    );

    // Solo procesamos eventos de tipo "payment"
    if (eventType === 'payment' && paymentId) {
      // Fire-and-forget: respondemos 200 inmediatamente y procesamos en background
      this.mpWebhooksService
        .processPaymentWebhook(tenantId, paymentId)
        .catch((err: Error) => {
          this.logger.error(
            `[Tenant: ${tenantId}] Error procesando webhook de pago ${paymentId}: ${err.message}`,
          );
        });
    } else {
      this.logger.warn(
        `[Tenant: ${tenantId}] Webhook ignorado. Tipo no procesable: ${eventType ?? 'sin tipo'}.`,
      );
    }

    return { received: true };
  }
}
