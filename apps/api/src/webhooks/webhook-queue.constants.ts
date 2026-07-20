/**
 * @file webhook-queue.constants.ts
 * @description Constantes compartidas entre el producer y el processor de la
 * cola BullMQ de webhooks de Mercado Pago.
 *
 * Centralizar aquí los nombres de queues y jobs evita typos y facilita
 * el refactoring futuro.
 */

/** Nombre de la cola BullMQ para procesar webhooks de Mercado Pago. */
export const WEBHOOK_QUEUE_NAME = 'mp-webhook-processing';

/** Nombre del job para procesar un pago de Mercado Pago. */
export const PROCESS_MP_PAYMENT_JOB = 'process-mp-payment';

/** Nombre del job para procesar un webhook de Andreani. */
export const PROCESS_ANDREANI_JOB = 'process-andreani';
