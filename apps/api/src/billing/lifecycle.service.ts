/**
 * @file lifecycle.service.ts
 * @description Servicio de Ciclo de Vida del Tenant – Evaluación diaria de estados de billing.
 *
 * Hito 10 – Monetización SaaS y Ciclo de Vida del Tenant
 * ─────────────────────────────────────────────────────────────────────────────
 * Cronjob que se ejecuta diariamente a medianoche y evalúa el estado de todos
 * los tenants según las reglas del ciclo de vida SaaS:
 *
 * 1. trial → grace_period:
 *    Si `trial_ends_at < NOW()` y el tenant sigue en estado 'trial', se
 *    asigna `grace_period_ends_at` = NOW() + GRACE_PERIOD_DAYS días.
 *
 * 2. active → grace_period:
 *    Si `next_billing_date < NOW()` y el tenant sigue en estado 'active',
 *    se asigna el período de gracia.
 *
 * 3. grace_period → suspended:
 *    Si `grace_period_ends_at < NOW()`, el tenant pasa a 'suspended'.
 *    `suspended_at` = NOW(). La store queda offline vía middleware/RLS.
 *
 * 4. suspended → deleted (eliminación lógica):
 *    Si el tenant lleva SUSPENSION_TO_DELETED_DAYS días en 'suspended',
 *    se marca como 'deleted'. NO se eliminan filas físicamente.
 *
 * ARQUITECTURA:
 *   - SQL puro vía `DbService.queryRaw()` (bypass de ALS/RLS) para acceso
 *     global de superadmin. Esto es seguro porque las queries son de sistema
 *     y no exponen datos a través de la API de usuario.
 *   - El Cronjob NO debe ejecutarse dentro de un contexto ALS de tenant.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DbService } from '../db/db.service.js';
import { BILLING_CONFIG } from './billing.types.js';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(private readonly db: DbService) {}

  /**
   * Evaluación diaria del ciclo de vida de todos los tenants.
   * Se ejecuta todos los días a medianoche (UTC).
   *
   * El orden de las transiciones importa para evitar saltos de estado:
   *   1. suspended → deleted   (primero para no volver a evaluar)
   *   2. grace_period → suspended
   *   3. trial → grace_period
   *   4. active → grace_period
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async evaluateTenantLifecycles(): Promise<void> {
    this.logger.log('🔄 [Billing Cronjob] Iniciando evaluación diaria de ciclo de vida de tenants...');

    try {
      // ── Paso 1: suspended → deleted (lógico) ─────────────────────────────
      // Tenants suspendidos por más de SUSPENSION_TO_DELETED_DAYS días.
      const deletedResult = await this.db.queryRaw<{ tenant_id: string }>(
        `UPDATE tenant_billing
        SET
          status     = 'deleted',
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE
          status       = 'suspended'
          AND suspended_at IS NOT NULL
          AND suspended_at < NOW() - MAKE_INTERVAL(days => $1)
        RETURNING tenant_id`,
        [BILLING_CONFIG.SUSPENSION_TO_DELETED_DAYS],
      );
      if (deletedResult.rowCount && deletedResult.rowCount > 0) {
        this.logger.warn(
          `🗑️  [Billing Cronjob] ${deletedResult.rowCount} tenants marcados como 'deleted': ` +
          deletedResult.rows.map(r => r.tenant_id).join(', '),
        );
      }

      // ── Paso 2: grace_period → suspended ─────────────────────────────────
      // Tenants cuyo período de gracia ya venció.
      const suspendedResult = await this.db.queryRaw<{ tenant_id: string }>(`
        UPDATE tenant_billing
        SET
          status       = 'suspended',
          suspended_at = NOW(),
          updated_at   = NOW()
        WHERE
          status               = 'grace_period'
          AND grace_period_ends_at IS NOT NULL
          AND grace_period_ends_at < NOW()
        RETURNING tenant_id
      `);
      if (suspendedResult.rowCount && suspendedResult.rowCount > 0) {
        this.logger.warn(
          `⏸️  [Billing Cronjob] ${suspendedResult.rowCount} tenants suspendidos: ` +
          suspendedResult.rows.map(r => r.tenant_id).join(', '),
        );
      }

      // ── Paso 3: trial → grace_period ─────────────────────────────────────
      // Trials vencidos sin pago registrado.
      const trialExpiredResult = await this.db.queryRaw<{ tenant_id: string }>(
        `UPDATE tenant_billing
        SET
          status               = 'grace_period',
          grace_period_ends_at = NOW() + MAKE_INTERVAL(days => $1),
          updated_at           = NOW()
        WHERE
          status        = 'trial'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at < NOW()
        RETURNING tenant_id`,
        [BILLING_CONFIG.GRACE_PERIOD_DAYS],
      );
      if (trialExpiredResult.rowCount && trialExpiredResult.rowCount > 0) {
        this.logger.warn(
          `⚠️  [Billing Cronjob] ${trialExpiredResult.rowCount} tenants pasaron de 'trial' a 'grace_period': ` +
          trialExpiredResult.rows.map(r => r.tenant_id).join(', '),
        );
      }

      // ── Paso 4: active → grace_period ────────────────────────────────────
      // Tenants activos con fecha de próximo cobro vencida (pago no procesado).
      const billingExpiredResult = await this.db.queryRaw<{ tenant_id: string }>(
        `UPDATE tenant_billing
        SET
          status               = 'grace_period',
          grace_period_ends_at = NOW() + MAKE_INTERVAL(days => $1),
          updated_at           = NOW()
        WHERE
          status            = 'active'
          AND next_billing_date IS NOT NULL
          AND next_billing_date < NOW()
        RETURNING tenant_id`,
        [BILLING_CONFIG.GRACE_PERIOD_DAYS],
      );
      if (billingExpiredResult.rowCount && billingExpiredResult.rowCount > 0) {
        this.logger.warn(
          `⚠️  [Billing Cronjob] ${billingExpiredResult.rowCount} tenants activos pasaron a 'grace_period' por pago vencido: ` +
          billingExpiredResult.rows.map(r => r.tenant_id).join(', '),
        );
      }

      const totalAffected =
        (deletedResult.rowCount ?? 0) +
        (suspendedResult.rowCount ?? 0) +
        (trialExpiredResult.rowCount ?? 0) +
        (billingExpiredResult.rowCount ?? 0);

      this.logger.log(
        `✅ [Billing Cronjob] Evaluación completada. Total de tenants actualizados: ${totalAffected}`,
      );
    } catch (error) {
      this.logger.error('[Billing Cronjob] Error durante la evaluación del ciclo de vida:', error);
      // No relanzamos el error para evitar que el scheduler deje de funcionar.
    }
  }
}
