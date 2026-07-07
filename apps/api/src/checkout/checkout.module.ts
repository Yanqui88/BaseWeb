/**
 * @file checkout.module.ts
 * @description Módulo NestJS para la generación de preferencias de pago en Mercado Pago.
 *
 * **Responsabilidades:**
 * - Exponer el endpoint `POST /checkout/preference` para uso del frontend de la tienda pública.
 * - Resolver el tenant activo desde el header `x-tenant-domain` mediante `PublicTenantInterceptor`.
 * - Obtener el `access_token` del tenant y crear la preferencia de pago en la API de MP.
 *
 * **Dependencias:**
 * - `HttpModule` (`@nestjs/axios`): Para realizar el POST a `https://api.mercadopago.com/checkout/preferences`.
 * - `DbModule` (global): Provee `DbService` automáticamente vía el decorador `@Global()`.
 * - `PublicTenantInterceptor`: Provisto e importado desde `PublicTenantModule` (o reexportado aquí).
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@Module({
  imports: [HttpModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PublicTenantInterceptor],
})
export class CheckoutModule {}
