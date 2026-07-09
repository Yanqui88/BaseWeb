/**
 * @file orders.module.ts
 * @description Módulo NestJS que agrupa los controladores y servicios de órdenes.
 *
 * Importa CheckoutModule (para crear la preferencia de MP) y EmailModule
 * (para enviar notificaciones transaccionales al aprobar el pago).
 */

import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { DbModule } from '../db/db.module.js';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { EmailModule } from '../email/email.module.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@Module({
  imports: [DbModule, CheckoutModule, EmailModule],
  controllers: [OrdersController],
  providers: [OrdersService, PublicTenantInterceptor],
  exports: [OrdersService],
})
export class OrdersModule {}
