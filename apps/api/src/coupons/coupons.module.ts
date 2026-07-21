/**
 * @file coupons.module.ts
 * @description Módulo NestJS que agrupa la funcionalidad del Motor de Cupones.
 *
 * Registra:
 *  - `AdminCouponsController`:  endpoints /admin/:tenantSlug/coupons (CRUD)
 *  - `PublicCouponsController`: endpoint  /public/coupons/validate/:code
 *  - `CouponsService`:          lógica de negocio compartida
 *  - `PublicTenantInterceptor`: proveído localmente para inyección en el
 *                               `PublicCouponsController`
 *
 * No es necesario importar `DbModule` explícitamente porque está marcado
 * como `@Global()` en el proyecto.
 */

import { Module } from '@nestjs/common';
import { AdminCouponsController, PublicCouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@Module({
  controllers: [AdminCouponsController, PublicCouponsController],
  providers: [CouponsService, PublicTenantInterceptor],
  exports: [CouponsService],
})
export class CouponsModule {}
