import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // TABLA: coupons
  //    Motor de cupones y descuentos multi-tenant.
  //
  //    - discount_type: 'percentage' aplica un porcentaje sobre el subtotal;
  //                     'fixed_amount' resta un monto fijo.
  //    - usage_limit:   NULL significa ilimitado.
  //    - is_active:     soft-delete / desactivación sin borrar el historial.
  //    - Aislamiento garantizado por RLS (current_setting app.current_tenant_id).
  // ──────────────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE coupons (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

      -- Código del cupón, único dentro del mismo tenant
      code            VARCHAR(100) NOT NULL,

      -- Tipo de descuento
      -- Valores válidos: 'percentage' | 'fixed_amount'
      discount_type   VARCHAR(20)  NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),

      -- Valor del descuento: porcentaje (0–100) o monto fijo
      discount_value  NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),

      -- Ventana de validez temporal
      valid_from      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      valid_until     TIMESTAMP WITH TIME ZONE,

      -- Límite de usos totales (NULL = ilimitado) y contador actual
      usage_limit     INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
      times_used      INTEGER NOT NULL DEFAULT 0,

      -- Estado activo / inactivo (soft-delete)
      is_active       BOOLEAN NOT NULL DEFAULT true,

      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      -- Constraint: código único por tenant (un mismo código puede existir en tenants distintos)
      CONSTRAINT coupons_code_tenant_unique UNIQUE (tenant_id, code)
    );
  `);

  // Índices para búsquedas frecuentes
  pgm.sql('CREATE INDEX coupons_tenant_id_idx ON coupons(tenant_id);');
  pgm.sql('CREATE INDEX coupons_code_idx ON coupons(tenant_id, code);');
  pgm.sql('CREATE INDEX coupons_active_idx ON coupons(tenant_id, is_active) WHERE is_active = true;');

  // ──────────────────────────────────────────────────────────────────────────
  // RLS para coupons – patrón estándar del proyecto
  // ──────────────────────────────────────────────────────────────────────────
  pgm.sql('ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE coupons FORCE ROW LEVEL SECURITY;');

  pgm.sql(`
    CREATE POLICY coupons_tenant_isolation_policy ON coupons
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY IF EXISTS coupons_tenant_isolation_policy ON coupons;');
  pgm.sql('DROP TABLE IF EXISTS coupons CASCADE;');
}
