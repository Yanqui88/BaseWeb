/**
 * @file saas.module.ts
 * @description Módulo NestJS para el onboarding self-service y billing SaaS.
 *
 * Hito 11 – Onboarding Self-Service + Fase 5: Billing SaaS
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo encapsula:
 *
 * Endpoints de onboarding (públicos):
 *   GET  /saas/check-domain/:domain
 *   POST /saas/register
 *
 * Endpoints de billing SaaS:
 *   POST /saas/billing/create-preference   → JWT protegido
 *   GET  /saas/billing/status              → JWT protegido
 *   POST /saas/billing/webhook             → Público (MP notifications)
 *
 * Depende de:
 *   - `DbModule` (global @Global) → `DbService` disponible sin importar.
 *   - `JwtModule` → para `JwtAuthGuard` en el billing controller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SaasController } from './saas.controller.js';
import { SaasService } from './saas.service.js';
import { SaasBillingController } from './saas-billing.controller.js';
import { SaasBillingService } from './saas-billing.service.js';

@Module({
  imports: [
    // JwtModule necesario para que JwtAuthGuard pueda verificar tokens
    // en los endpoints protegidos del SaasBillingController.
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [SaasController, SaasBillingController],
  providers: [SaasService, SaasBillingService],
})
export class SaasModule {}
