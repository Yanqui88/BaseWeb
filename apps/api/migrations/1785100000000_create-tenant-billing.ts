import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/**
 * Hito 10 – Monetización SaaS y Ciclo de Vida del Tenant
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea la tabla `tenant_billing` para gestionar el estado de facturación y
 * ciclo de vida de cada tenant en el sistema multi-tenant.
 *
 * Estados del ciclo de vida:
 *   active        → Tenant activo, con suscripción vigente.
 *   trial         → Tenant en período de prueba gratuito.
 *   grace_period  → Pago vencido, con período de gracia antes de suspensión.
 *   suspended     → Tenant suspendido (store desconectada).
 *   deleted       → Eliminación lógica tras período de suspensión extendido.
 *
 * RLS: Cada tenant solo ve su propia fila; el superadmin tiene acceso total.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Crear el tipo ENUM para el estado de facturación del tenant
  pgm.sql(`
    CREATE TYPE "TenantBillingStatus" AS ENUM (
      'trial',
      'active',
      'grace_period',
      'suspended',
      'deleted'
    );
  `);

  // 2. Crear la tabla tenant_billing
  //    - tenant_id es FK + PK (relación 1:1 con tenants)
  //    - ON DELETE CASCADE garantiza limpieza automática si se elimina el tenant
  pgm.sql(`
    CREATE TABLE tenant_billing (
      tenant_id             UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      status                "TenantBillingStatus" NOT NULL DEFAULT 'trial',
      trial_ends_at         TIMESTAMP WITH TIME ZONE,
      next_billing_date     TIMESTAMP WITH TIME ZONE,
      grace_period_ends_at  TIMESTAMP WITH TIME ZONE,
      suspended_at          TIMESTAMP WITH TIME ZONE,
      deleted_at            TIMESTAMP WITH TIME ZONE,
      plan_id               VARCHAR(100),
      created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Índice para consultas de Cronjob (evaluación masiva por estado y fechas)
  pgm.sql(`
    CREATE INDEX idx_tenant_billing_status ON tenant_billing(status);
  `);
  pgm.sql(`
    CREATE INDEX idx_tenant_billing_trial_ends_at ON tenant_billing(trial_ends_at)
      WHERE status = 'trial';
  `);
  pgm.sql(`
    CREATE INDEX idx_tenant_billing_next_billing_date ON tenant_billing(next_billing_date)
      WHERE status = 'active';
  `);
  pgm.sql(`
    CREATE INDEX idx_tenant_billing_grace_period_ends_at ON tenant_billing(grace_period_ends_at)
      WHERE status = 'grace_period';
  `);
  pgm.sql(`
    CREATE INDEX idx_tenant_billing_suspended_at ON tenant_billing(suspended_at)
      WHERE status = 'suspended';
  `);

  // 4. Habilitar y forzar RLS en tenant_billing
  pgm.sql(`ALTER TABLE tenant_billing ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE tenant_billing FORCE ROW LEVEL SECURITY;`);

  // 5. Política RLS: cada tenant ve solo su fila; superadmin tiene acceso total
  pgm.sql(`
    CREATE POLICY tenant_billing_isolation ON tenant_billing
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // 6. Insertar registro inicial de billing para todos los tenants existentes
  //    (trial de 30 días desde ahora por defecto)
  pgm.sql(`
    INSERT INTO tenant_billing (tenant_id, status, trial_ends_at, created_at, updated_at)
    SELECT
      id,
      'trial',
      NOW() + INTERVAL '30 days',
      NOW(),
      NOW()
    FROM tenants
    ON CONFLICT (tenant_id) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS tenant_billing CASCADE;`);
  pgm.sql(`DROP TYPE IF EXISTS "TenantBillingStatus" CASCADE;`);
}
