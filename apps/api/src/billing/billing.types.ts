/**
 * @file billing.types.ts
 * @description Tipos de dominio para el módulo de Billing y Ciclo de Vida del Tenant.
 *
 * Hito 10 – Monetización SaaS y Ciclo de Vida del Tenant
 */

/** Estados del ciclo de vida de la facturación de un tenant. */
export type TenantBillingStatus =
  | 'trial'         // Período de prueba gratuito activo
  | 'active'        // Suscripción vigente y al día
  | 'grace_period'  // Pago vencido, en período de gracia antes de suspensión
  | 'suspended'     // Tenant suspendido (store offline)
  | 'deleted';      // Eliminación lógica tras suspensión extendida

/** Registro completo de billing de un tenant. */
export interface TenantBillingRecord {
  tenant_id: string;
  status: TenantBillingStatus;
  trial_ends_at: Date | null;
  next_billing_date: Date | null;
  grace_period_ends_at: Date | null;
  suspended_at: Date | null;
  deleted_at: Date | null;
  plan_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Configuración de duración de los períodos del ciclo de vida. */
export const BILLING_CONFIG = {
  /** Duración del período de gracia (en días) tras vencimiento del pago. */
  GRACE_PERIOD_DAYS: 7,
  /** Días de suspensión antes de marcarse como 'deleted' (eliminación lógica). */
  SUSPENSION_TO_DELETED_DAYS: 30,
  /** Duración del trial por defecto si no se especifica (en días). */
  DEFAULT_TRIAL_DAYS: 30,
} as const;
