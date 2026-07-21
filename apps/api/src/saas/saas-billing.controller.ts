/**
 * @file saas-billing.controller.ts
 * @description Controlador de endpoints de billing SaaS para Mercado Pago.
 *
 * Hito 11 – Fase 5: Billing SaaS
 * ─────────────────────────────────────────────────────────────────────────────
 * Expone los siguientes endpoints bajo el prefijo `/saas/billing`:
 *
 *   POST /saas/billing/create-preference   → JWT protegido. Genera una
 *     preferencia de Checkout Pro. El tenant_id se extrae del JWT payload.
 *
 *   GET  /saas/billing/status              → JWT protegido. Retorna el estado
 *     actual de billing del tenant autenticado (trial, active, suspended, etc.).
 *
 *   POST /saas/billing/webhook             → PÚBLICO (sin JWT). Recibe
 *     notificaciones de Mercado Pago. El pago se verifica consultando la API
 *     de MP (anti-replay). Responde 200 OK siempre de inmediato.
 *
 * Seguridad en el webhook:
 *   - `@SkipThrottle()`: excluye de rate-limiting para que MP pueda reintentar.
 *   - Sin `@UseGuards(JwtAuthGuard)`: es un endpoint público de MP.
 *   - La validación real del pago ocurre dentro del servicio consultando la
 *     API de MP con la clave maestra (nunca se confía en el payload solo).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  SaasBillingService,
  type CreatePreferenceResult,
  type MpWebhookPayload,
} from './saas-billing.service.js';

@Controller('saas/billing')
export class SaasBillingController {
  constructor(private readonly saasBillingService: SaasBillingService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // POST /saas/billing/create-preference
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Crea una preferencia de pago en Mercado Pago Checkout Pro por $29 USD.
   *
   * Requiere autenticación JWT. El `tenant_id` y `email` se extraen del
   * payload del token (seteados por `JwtAuthGuard`).
   *
   * @returns `{ preferenceId, initPoint }` para redirigir al usuario a MP.
   */
  @Post('create-preference')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPreference(
    @Req() req: Request,
  ): Promise<CreatePreferenceResult> {
    const user = (req as any)['user'] as { tenantId?: string; sub?: string; email?: string };
    const tenantId = user?.tenantId ?? user?.sub ?? '';
    const userEmail = user?.email;

    return this.saasBillingService.createSubscriptionPreference(
      tenantId,
      userEmail,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /saas/billing/status
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el estado actual del billing del tenant autenticado.
   *
   * @returns `{ status, trial_ends_at, days_remaining }`
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getBillingStatus(@Req() req: Request) {
    const user = (req as any)['user'] as { tenantId?: string; sub?: string };
    const tenantId = user?.tenantId ?? user?.sub ?? '';
    return this.saasBillingService.getBillingStatus(tenantId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /saas/billing/webhook
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Endpoint público para recibir notificaciones IPN/Webhook de Mercado Pago.
   *
   * ⚠️  Sin JWT. Sin rate-limiting (@SkipThrottle).
   * El pago se verifica consultando la API de MP → protección anti-replay.
   * Siempre responde HTTP 200 OK para que MP no reintente el envío.
   *
   * @param payload - Cuerpo del webhook enviado por MP.
   * @returns `{ received: true }`
   */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    const mpPayload = payload as MpWebhookPayload;

    // Procesamos de forma asíncrona sin bloquear la respuesta
    // para garantizar el 200 OK inmediato que MP necesita.
    this.saasBillingService
      .processWebhook(mpPayload)
      .catch((err) => {
        // El servicio ya loggea internamente, pero capturamos aquí
        // por si hay un error no controlado que no debe romper la respuesta.
        console.error('[SaasBillingController] Error procesando webhook:', err);
      });

    return { received: true };
  }
}
