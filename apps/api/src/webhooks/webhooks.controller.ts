/**
 * @file webhooks.controller.ts
 * @description Controlador que expone los endpoints para recibir notificaciones
 * externas de Mercado Pago y Andreani.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANTE — Respuesta HTTP 200 obligatoria:
 * ─────────────────────────────────────────────────────────────────────────────
 * Tanto Mercado Pago como Andreani reintentan el envío del webhook si reciben
 * una respuesta distinta de 2xx. Por eso, TODOS los endpoints de este controlador
 * responden 200 OK de forma inmediata, y el procesamiento real (lectura de DB,
 * actualización de estado) se realiza de forma asíncrona en el `WebhooksService`.
 *
 * Si el procesamiento falla internamente, el error queda registrado en los logs
 * de NestJS pero NO se propaga al proveedor externo.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️  NOTA SOBRE EL `TenantInterceptor` GLOBAL:
 * Este controlador es alcanzado por el `TenantInterceptor` global definido en
 * `AppModule`. Sin embargo, los webhooks no envían el header `x-tenant-id`, por
 * lo que el interceptor no encontrará un tenant y dejará el ALS vacío. El
 * `WebhooksService` gestiona su propio contexto ALS internamente (superadmin
 * primero, luego tenant específico).
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';

/** Payload enviado por Mercado Pago en notificaciones de tipo 'payment'. */
interface MpWebhookPayload {
  type: string;
  data?: {
    id?: string;
  };
}

/** Payload enviado por Andreani con el estado del envío. */
interface AndreaniWebhookPayload {
  numeroDeEnvio: string;
  estadoActual: string;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  // ────────────────────────────────────────────────────────────────────────────
  // POST /webhooks/mp
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Recibe notificaciones de Mercado Pago.
   *
   * MP envía eventos de múltiples tipos (`payment`, `merchant_order`, etc.).
   * Solo se procesan los eventos de tipo `payment`; el resto se ignoran
   * respondiendo 200 OK inmediatamente para evitar reintentos innecesarios.
   *
   * @see https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
   */
  @Post('mp')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPago(@Body() payload: MpWebhookPayload): Promise<void> {
    const paymentId = payload?.data?.id;

    // Ignorar eventos que no sean de tipo 'payment'
    if (payload?.type !== 'payment' || !paymentId) {
      this.logger.log(
        `[MP Webhook] Evento ignorado. type="${payload?.type}", id="${paymentId ?? 'N/A'}".`,
      );
      return;
    }

    this.logger.log(`[MP Webhook] Evento de pago recibido. payment_id="${paymentId}".`);

    // Procesamos de forma fire-and-forget: la respuesta 200 ya fue enviada.
    // Usamos .catch() para evitar que un error rechazado quede sin manejar.
    this.webhooksService
      .handleMercadoPagoNotification(paymentId, payload.type)
      .catch((err: Error) =>
        this.logger.error(
          `[MP Webhook] Error procesando pago ${paymentId}: ${err.message}`,
          err.stack,
        ),
      );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // POST /webhooks/andreani
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Recibe notificaciones de estado logístico de Andreani.
   *
   * Andreani envía el número de envío y el estado actual. Si algún campo
   * está ausente, se ignora la notificación y se responde 200 OK.
   */
  @Post('andreani')
  @HttpCode(HttpStatus.OK)
  async handleAndreani(@Body() payload: AndreaniWebhookPayload): Promise<void> {
    const { numeroDeEnvio, estadoActual } = payload ?? {};

    if (!numeroDeEnvio || !estadoActual) {
      this.logger.warn(
        `[Andreani Webhook] Payload incompleto recibido. numeroDeEnvio="${numeroDeEnvio ?? 'N/A'}", ` +
          `estadoActual="${estadoActual ?? 'N/A'}". Ignorando.`,
      );
      return;
    }

    this.logger.log(
      `[Andreani Webhook] Notificación recibida. envio="${numeroDeEnvio}", estado="${estadoActual}".`,
    );

    // Fire-and-forget: respondemos 200 inmediatamente.
    this.webhooksService
      .handleAndreaniNotification(numeroDeEnvio, estadoActual)
      .catch((err: Error) =>
        this.logger.error(
          `[Andreani Webhook] Error procesando envío ${numeroDeEnvio}: ${err.message}`,
          err.stack,
        ),
      );
  }
}
