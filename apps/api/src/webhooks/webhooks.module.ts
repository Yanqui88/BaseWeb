/**
 * @file webhooks.module.ts
 * @description Módulo NestJS que agrupa el controlador, servicio y processor
 * de webhooks externos (Mercado Pago y Andreani).
 *
 * Hito 8 – cambios:
 * - Importa `BullModule.registerQueue` para registrar la cola de procesamiento
 *   de webhooks respaldada por Redis (ioredis).
 * - Registra `WebhookQueueProcessor` como worker de BullMQ.
 * - El `WebhooksController` ya no llama directamente al servicio: encola jobs.
 * - El `WebhooksService` sigue siendo el handler de procesamiento, ahora
 *   invocado desde el `WebhookQueueProcessor` en background.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookQueueProcessor } from './webhook-queue.processor.js';
import { OrdersModule } from '../orders/orders.module.js';
import { DbModule } from '../db/db.module.js';
import { WEBHOOK_QUEUE_NAME } from './webhook-queue.constants.js';

@Module({
  imports: [
    DbModule,      // Provee DbService (pool pg + ALS para RLS)
    OrdersModule,  // Provee OrdersService (ya exportado por OrdersModule)

    // Cola BullMQ respaldada por Redis.
    // La conexión se toma de REDIS_URL o REDIS_HOST/REDIS_PORT del entorno.
    BullModule.registerQueueAsync({
      name: WEBHOOK_QUEUE_NAME,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        const host = process.env.REDIS_HOST ?? 'localhost';
        const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

        return {
          connection: redisUrl
            ? { host: new URL(redisUrl).hostname, port: parseInt(new URL(redisUrl).port || '6379', 10) }
            : { host, port },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
          },
        };
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,           // Lógica de procesamiento (SUPERADMIN → TENANT ALS)
    WebhookQueueProcessor,     // Worker BullMQ que consume los jobs de la cola
  ],
})
export class WebhooksModule {}
