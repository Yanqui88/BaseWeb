/**
 * @file tenants.module.ts
 * @description Módulo NestJS para la gestión de tenants desde el sistema.
 *
 * Expone el endpoint de validación de dominio consumido por Caddy (módulo `ask`)
 * y cualquier otra operación de sistema sobre la tabla `tenants`.
 */

import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
