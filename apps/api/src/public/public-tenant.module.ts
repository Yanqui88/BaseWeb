/**
 * @file public-tenant.module.ts
 * @description Módulo NestJS que encapsula la funcionalidad pública de resolución
 * de tenant por dominio.
 *
 * Provee:
 * - `PublicTenantInterceptor`: resuelve el tenant desde el header `x-tenant-domain`
 *   y activa el contexto RLS en el `AsyncLocalStorage`.
 * - `PublicTenantService`: lógica SQL para obtener las configuraciones visuales
 *   del tenant activo (protegidas automáticamente por RLS).
 * - `PublicTenantController`: expone el endpoint `GET /public/tenant/config`.
 *
 * El módulo NO declara `DbModule` en sus imports porque `DbModule` está marcado
 * como `@Global()` en el proyecto, lo que hace que `DbService` esté disponible
 * para inyección en todos los módulos sin declaración explícita.
 */

import { Module } from '@nestjs/common';
import { PublicTenantController } from './public-tenant.controller.js';
import { PublicTenantInterceptor } from './public-tenant.interceptor.js';
import { PublicTenantService } from './public-tenant.service.js';

@Module({
  controllers: [PublicTenantController],
  providers: [PublicTenantInterceptor, PublicTenantService],
})
export class PublicTenantModule {}
