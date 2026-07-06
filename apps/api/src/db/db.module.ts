/**
 * @file db.module.ts
 * @description Módulo global de acceso a la base de datos.
 *
 * Al estar marcado con `@Global()`, este módulo no necesita ser importado
 * individualmente en cada feature module: cualquier módulo de la aplicación
 * puede inyectar `DbService` o `TenantInterceptor` directamente.
 *
 * **Responsabilidades de este módulo:**
 * - Proveer y exportar `DbService` (pool de conexiones + contexto RLS via ALS).
 * - Proveer y exportar `TenantInterceptor` (activación del contexto RLS por ruta).
 *
 * **Dependencias externas:** `pg` (driver nativo de PostgreSQL), `async_hooks`
 * (módulo nativo de Node.js). No se utiliza ningún ORM.
 */

import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service.js';
import { TenantInterceptor } from './tenant.interceptor.js';

@Global()
@Module({
  providers: [DbService, TenantInterceptor],
  exports: [DbService, TenantInterceptor],
})
export class DbModule {}
