/**
 * @file webhooks.controller.ts
 * @description Controlador de recepción de webhooks externos (Mercado Pago y Andreani).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HITO 8 – SEGURIDAD Y AUDITORÍA:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. VALIDACIÓN HMAC (x-signature de Mercado Pago):
 *    Mercado Pago firma cada webhook con HMAC-SHA256 usando un secret configurado
 *    en el panel de desarrolladores. El header `x-signature` contiene:
 *      ts=<timestamp>&v1=<hmac_hex>
 *    El mensaje que se firma es: "id:<payment_id>;request-id:<x-request-id>;ts:<ts>"
 *    Si la firma no es válida, se responde 200 OK (para evitar reintentos) pero
 *    se descarta el evento y se loguea el rechazo.
 *
 * 2. RESPUESTA ASINCRÓNICA INMEDIATA (200 OK):
 *    El controlador encola el job en BullMQ y responde 200 OK inmediatamente.
 *    El procesamiento pesado (lectura de DB, actualización de estado) ocurre
 *    en background en el `WebhookQueueProcessor`, sin bloquear la respuesta.
 *
 * 3. IDEMPOTENCIA:
 *    Garantizada a nivel SQL por el UNIQUE INDEX en `orders.mp_transaction_id`
 *    y el ON CONFLICT DO UPDATE en `mp_transactions`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTA SOBRE TenantInterceptor GLOBAL:
 * Los webhooks no envían `x-tenant-id`, por lo que el ALS quedará vacío.
 * El WebhooksService gestiona su propio contexto ALS internamente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as crypto from 'crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PROCESS_ANDREANI_JOB,
  PROCESS_MP_PAYMENT_JOB,
  WEBHOOK_QUEUE_NAME,
} from './webhook-queue.constants.js';
import type { AndreaniJobPayload, MpPaymentJobPayload } from './webhook-queue.processor.js';

/** Payload enviado por Mercado Pago en notificaciones modernas de tipo 'payment'. */
interface MpWebhookPayload {
  type?: string;
  topic?: string;
  data?: {
    id?: string | number;
  };
  id?: string | number;
}

/** Payload enviado por Andreani con el estado del envío. */
interface AndreaniWebhookPayload {
  numeroDeEnvio: string;
  estadoActual: string;
}

/** Resultado de parsear el header `x-signature` de Mercado Pago. */
interface MpSignatureParts {
  ts: string;
  v1: string;
}

/**
 * @SkipThrottle: Los webhooks de MP y Andreani provienen de servidores
 * externos confiables, no de usuarios finales. No aplicar rate limiting.
 */
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  /**
   * Secret HMAC de Mercado Pago (configurado en el panel de desarrolladores).
   * Variable de entorno: MP_WEBHOOK_SECRET
   */
  private readonly mpWebhookSecret = process.env.MP_WEBHOOK_SECRET ?? '';

  constructor(
    @InjectQueue(WEBHOOK_QUEUE_NAME)
    private readonly webhookQueue: Queue,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // POST /webhooks/mp
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Recibe notificaciones de Mercado Pago con validación HMAC-SHA256.
   *
   * Flujo:
   *  1. Parsear el header `x-signature` para extraer ts y v1.
   *  2. Reconstruir el mensaje firmado: "id:<paymentId>;request-id:<xRequestId>;ts:<ts>"
   *  3. Calcular HMAC-SHA256 con el secret y comparar con v1 (timing-safe).
   *  4. Si válido → encolar job en BullMQ y responder 200 OK inmediatamente.
   *  5. Si inválido → loguear y responder 200 OK (evitar reintentos de MP).
   *
   * @see https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#editor_5
   */
  @Post('mp')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPago(
    @Body() payload: MpWebhookPayload,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
  ): Promise<{ received: boolean }> {
    // ── Extraer paymentId del payload ─────────────────────────────────────────
    const rawId = payload?.data?.id ?? payload?.id;
    const paymentId = rawId != null ? String(rawId) : null;
    const eventType = payload?.type ?? payload?.topic;

    this.logger.log(
      `[MP Webhook] Notificación recibida. type="${eventType ?? 'N/A'}", id="${paymentId ?? 'N/A'}".`,
    );

    // ── Validación HMAC ────────────────────────────────────────────────────────
    const isSignatureValid = this.verifyMpHmac(xSignature, xRequestId ?? '', paymentId ?? '');

    if (!isSignatureValid) {
      this.logger.warn(
        `[MP Webhook] ⚠️  Firma HMAC inválida o ausente para paymentId="${paymentId ?? 'N/A'}". ` +
          `Evento descartado (200 OK para evitar reintentos).`,
      );
      // Respondemos 200 OK de todas formas para que MP no reintente.
      // Un atacante que envíe payloads falsos no aprende nada de nuestra lógica.
      return { received: false };
    }

    // ── Ignorar eventos que no sean de tipo 'payment' ─────────────────────────
    if ((eventType !== 'payment' && eventType !== 'merchant_order') || !paymentId) {
      this.logger.log(`[MP Webhook] Evento tipo="${eventType}" ignorado (no es payment).`);
      return { received: true };
    }

    // ── Encolar job para procesamiento asíncrono ──────────────────────────────
    const jobData: MpPaymentJobPayload = {
      paymentId,
      mpStatus: eventType,
    };

    await this.webhookQueue.add(PROCESS_MP_PAYMENT_JOB, jobData, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    });

    this.logger.log(
      `[MP Webhook] ✅ Job encolado para paymentId="${paymentId}". Respondiendo 200 OK.`,
    );

    return { received: true };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // POST /webhooks/andreani
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Recibe notificaciones de estado logístico de Andreani.
   *
   * Andreani no implementa HMAC estándar, por lo que validamos solo la
   * presencia de los campos requeridos. El procesamiento es igualmente
   * asíncrono vía BullMQ.
   */
  @Post('andreani')
  @HttpCode(HttpStatus.OK)
  async handleAndreani(
    @Body() payload: AndreaniWebhookPayload,
  ): Promise<{ received: boolean }> {
    const { numeroDeEnvio, estadoActual } = payload ?? {};

    if (!numeroDeEnvio || !estadoActual) {
      this.logger.warn(
        `[Andreani Webhook] Payload incompleto. numeroDeEnvio="${numeroDeEnvio ?? 'N/A'}", ` +
          `estadoActual="${estadoActual ?? 'N/A'}". Ignorando.`,
      );
      return { received: false };
    }

    this.logger.log(
      `[Andreani Webhook] Notificación recibida. envio="${numeroDeEnvio}", estado="${estadoActual}".`,
    );

    // ── Encolar job para procesamiento asíncrono ──────────────────────────────
    const jobData: AndreaniJobPayload = { numeroDeEnvio, estadoActual };

    await this.webhookQueue.add(PROCESS_ANDREANI_JOB, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    });

    this.logger.log(
      `[Andreani Webhook] ✅ Job encolado para envio="${numeroDeEnvio}". Respondiendo 200 OK.`,
    );

    return { received: true };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UTILIDADES PRIVADAS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Verifica la firma HMAC-SHA256 del header `x-signature` de Mercado Pago.
   *
   * Algoritmo oficial de MP:
   *  1. Parsear `x-signature`: "ts=<timestamp>&v1=<hmac_sha256_hex>"
   *  2. Construir el mensaje: "id:<paymentId>;request-id:<xRequestId>;ts:<ts>"
   *  3. Calcular HMAC-SHA256 del mensaje con el secret.
   *  4. Comparar con timing-safe equals.
   *
   * Si `MP_WEBHOOK_SECRET` no está configurado, la validación se omite y
   * se loguea una advertencia (modo desarrollo sin secret).
   *
   * @param xSignature  - Valor del header `x-signature` enviado por MP.
   * @param xRequestId  - Valor del header `x-request-id` enviado por MP.
   * @param paymentId   - ID del pago/recurso del payload.
   * @returns true si la firma es válida (o si no hay secret configurado).
   */
  private verifyMpHmac(
    xSignature: string | undefined,
    xRequestId: string,
    paymentId: string,
  ): boolean {
    // Sin secret configurado: omitir validación (útil en desarrollo)
    if (!this.mpWebhookSecret) {
      this.logger.warn(
        '[MP Webhook] ⚠️  MP_WEBHOOK_SECRET no está configurado. ' +
          'Omitiendo validación HMAC (solo válido en desarrollo).',
      );
      return true;
    }

    if (!xSignature) {
      this.logger.warn('[MP Webhook] Header x-signature ausente.');
      return false;
    }

    // Parsear el header x-signature → { ts, v1 }
    const parts = this.parseMpSignature(xSignature);
    if (!parts) {
      this.logger.warn(`[MP Webhook] Formato de x-signature inválido: "${xSignature}".`);
      return false;
    }

    const { ts, v1 } = parts;

    // Construir el mensaje a firmar (formato oficial de Mercado Pago)
    const message = `id:${paymentId};request-id:${xRequestId};ts:${ts}`;

    // Calcular HMAC-SHA256
    const expectedHmac = crypto
      .createHmac('sha256', this.mpWebhookSecret)
      .update(message)
      .digest('hex');

    // Comparación timing-safe para evitar ataques de timing
    try {
      const expectedBuf = Buffer.from(expectedHmac, 'hex');
      const receivedBuf = Buffer.from(v1, 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      // Buffer.from con hex inválido lanza, lo tratamos como firma inválida
      return false;
    }
  }

  /**
   * Parsea el header `x-signature` de Mercado Pago.
   * Formato esperado: "ts=<timestamp>&v1=<hmac_hex>"
   *
   * @returns { ts, v1 } si el formato es válido, null si no.
   */
  private parseMpSignature(xSignature: string): MpSignatureParts | null {
    const parts: Partial<MpSignatureParts> = {};

    for (const part of xSignature.split(',')) {
      const [key, value] = part.trim().split('=', 2);
      if (key === 'ts' && value) parts.ts = value;
      if (key === 'v1' && value) parts.v1 = value;
    }

    if (!parts.ts || !parts.v1) return null;
    return parts as MpSignatureParts;
  }
}
