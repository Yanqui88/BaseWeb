/**
 * @file webhook-queue.processor.ts
 * @description Worker BullMQ que procesa de forma asíncrona los jobs de
 * webhooks de Mercado Pago y Andreani.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISEÑO DE IDEMPOTENCIA (SQL PURO):
 * ─────────────────────────────────────────────────────────────────────────────
 * La idempotencia se garantiza en dos capas:
 *
 * Capa 1 - Base de Datos (UNIQUE INDEX):
 *   La columna `orders.mp_transaction_id` tiene un UNIQUE INDEX parcial
 *   (WHERE mp_transaction_id IS NOT NULL). Si el webhook llega duplicado,
 *   el UPDATE de `updatePaymentStatus` no fallará (opera sobre el mismo
 *   registro) pero el INSERT ya estará protegido a nivel schema.
 *
 * Capa 2 - `mp_transactions` (ON CONFLICT DO UPDATE):
 *   El servicio `MpWebhooksService` ya usa UPSERT con ON CONFLICT, por lo
 *   que duplicados en esa tabla tampoco causan inconsistencias.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FLUJO:
 * ─────────────────────────────────────────────────────────────────────────────
 *  WebhooksController → encola job → responde 200 OK (inmediato)
 *      ↓ (background)
 *  WebhookQueueProcessor.processMpPayment()
 *      → WebhooksService.handleMercadoPagoNotification()
 *          → Fase 1: SELECT por mp_transaction_id (SUPERADMIN context)
 *          → Fase 2: UPDATE payment_status (tenant context)
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhooksService } from './webhooks.service.js';
import {
  PROCESS_ANDREANI_JOB,
  PROCESS_MP_PAYMENT_JOB,
  WEBHOOK_QUEUE_NAME,
} from './webhook-queue.constants.js';

/** Payload del job de procesamiento de pago de Mercado Pago. */
export interface MpPaymentJobPayload {
  paymentId: string;
  mpStatus: string;
  tenantId?: string | null;
}

/** Payload del job de procesamiento de webhook de Andreani. */
export interface AndreaniJobPayload {
  numeroDeEnvio: string;
  estadoActual: string;
}

@Processor(WEBHOOK_QUEUE_NAME)
export class WebhookQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookQueueProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  /**
   * Punto de entrada del worker. BullMQ llama a este método por cada job
   * que entra a la cola. El dispatcher enruta por `job.name`.
   */
  async process(job: Job): Promise<void> {
    this.logger.log(`[Queue] Procesando job id=${job.id} name=${job.name}`);

    switch (job.name) {
      case PROCESS_MP_PAYMENT_JOB:
        await this.processMpPayment(job as Job<MpPaymentJobPayload>);
        break;

      case PROCESS_ANDREANI_JOB:
        await this.processAndreani(job as Job<AndreaniJobPayload>);
        break;

      default:
        this.logger.warn(`[Queue] Job desconocido: ${job.name}. Ignorado.`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HANDLERS PRIVADOS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Procesa un job de pago de Mercado Pago.
   * Delega en WebhooksService que gestiona el contexto ALS (superadmin → tenant).
   */
  private async processMpPayment(job: Job<MpPaymentJobPayload>): Promise<void> {
    const { paymentId, mpStatus } = job.data;

    if (!paymentId) {
      this.logger.error(`[Queue] Job ${job.id} sin paymentId. Descartando.`);
      return;
    }

    this.logger.log(`[Queue:MP] Procesando pago paymentId="${paymentId}" status="${mpStatus}".`);

    try {
      await this.webhooksService.handleMercadoPagoNotification(paymentId, mpStatus);
      this.logger.log(`[Queue:MP] Pago "${paymentId}" procesado exitosamente.`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Queue:MP] Error procesando pago "${paymentId}": ${error.message}`,
        error.stack,
      );
      // Re-lanzar para que BullMQ registre el job como fallido y aplique
      // la política de reintentos configurada en el módulo.
      throw error;
    }
  }

  /**
   * Procesa un job de notificación de Andreani.
   * Delega en WebhooksService que gestiona el contexto ALS (superadmin → tenant).
   */
  private async processAndreani(job: Job<AndreaniJobPayload>): Promise<void> {
    const { numeroDeEnvio, estadoActual } = job.data;

    if (!numeroDeEnvio || !estadoActual) {
      this.logger.error(`[Queue] Job ${job.id} Andreani con datos incompletos. Descartando.`);
      return;
    }

    this.logger.log(
      `[Queue:Andreani] Procesando envío="${numeroDeEnvio}" estado="${estadoActual}".`,
    );

    try {
      await this.webhooksService.handleAndreaniNotification(numeroDeEnvio, estadoActual);
      this.logger.log(`[Queue:Andreani] Envío "${numeroDeEnvio}" procesado exitosamente.`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Queue:Andreani] Error procesando envío "${numeroDeEnvio}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
