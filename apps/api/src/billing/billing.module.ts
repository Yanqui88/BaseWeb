/**
 * @file billing.module.ts
 * @description Módulo de Billing y Ciclo de Vida del Tenant.
 *
 * Hito 10 – Monetización SaaS y Ciclo de Vida del Tenant
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsula la lógica de gestión del ciclo de vida de los tenants en el
 * contexto SaaS multi-tenant. Provee:
 *
 *   - `LifecycleService`: Cronjob diario que evalúa y transiciona estados
 *     de billing (trial → grace_period → suspended → deleted).
 *
 * Depende del `DbModule` (global) para acceder a `DbService` con SQL puro.
 * El `ScheduleModule` se importa en el `AppModule` con `forRoot()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service.js';

@Module({
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class BillingModule {}
