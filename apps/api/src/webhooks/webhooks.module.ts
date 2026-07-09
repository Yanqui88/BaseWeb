/**
 * @file webhooks.module.ts
 * @description Módulo NestJS que agrupa el controlador y servicio de webhooks
 * externos (Mercado Pago y Andreani).
 *
 * Importa `OrdersModule` (que exporta `OrdersService`) para poder actualizar
 * el estado de las órdenes desde el `WebhooksService`.
 * Importa `DbModule` para acceder al `DbService` y su ALS, necesario para
 * la estrategia de resolución de contexto Superadmin → Tenant.
 */

import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { DbModule } from '../db/db.module.js';

@Module({
  imports: [
    DbModule,      // Provee DbService (pool pg + ALS para RLS)
    OrdersModule,  // Provee OrdersService (ya exportado por OrdersModule)
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
