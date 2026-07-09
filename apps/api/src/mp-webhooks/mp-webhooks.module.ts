/**
 * @file mp-webhooks.module.ts
 * @description Módulo NestJS para la recepción y procesamiento de webhooks de Mercado Pago.
 *
 * **Responsabilidades:**
 * - Recibir las notificaciones IPN/webhook de Mercado Pago vía HTTP POST.
 * - Consultar la API de MP para obtener los detalles del pago.
 * - Persistir las transacciones en `mp_transactions` mediante SQL puro con RLS.
 *
 * **Dependencias:**
 * - `HttpModule` (`@nestjs/axios`): Para hacer GET a la API de pagos de Mercado Pago.
 * - `DbModule` (global): Provee `DbService` automáticamente vía el decorador `@Global()`.
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MpWebhooksController } from './mp-webhooks.controller.js';
import { MpWebhooksService } from './mp-webhooks.service.js';
import { OrdersModule } from '../orders/orders.module.js';

@Module({
  imports: [HttpModule, OrdersModule],
  controllers: [MpWebhooksController],
  providers: [MpWebhooksService],
})
export class MpWebhooksModule {}
