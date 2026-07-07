import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Para garantizar un aislamiento limpio y evitar colisiones con tablas previas de inicialización
  pgm.sql('DROP TABLE IF EXISTS inventories CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS locations CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS inventory CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS tenant_logistic_credentials CASCADE;');

  // 1. locations
  pgm.sql(`
    CREATE TABLE locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      city VARCHAR(255),
      state VARCHAR(255),
      zip_code VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // RLS para locations
  pgm.sql('ALTER TABLE locations ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE locations FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY locations_tenant_isolation_policy ON locations
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // 2. inventory
  pgm.sql(`
    CREATE TABLE inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      quantity INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT inventory_product_variant_location_key UNIQUE (product_variant_id, location_id)
    );
  `);

  // RLS para inventory
  pgm.sql('ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE inventory FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY inventory_tenant_isolation_policy ON inventory
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // 3. tenant_logistic_credentials
  pgm.sql(`
    CREATE TABLE tenant_logistic_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider VARCHAR(255) NOT NULL,
      andreani_username VARCHAR(255),
      andreani_password VARCHAR(255),
      andreani_client_id VARCHAR(255),
      andreani_contract VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT tenant_logistic_credentials_tenant_provider_key UNIQUE (tenant_id, provider)
    );
  `);

  // RLS para tenant_logistic_credentials
  pgm.sql('ALTER TABLE tenant_logistic_credentials ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE tenant_logistic_credentials FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_tenant_isolation_policy ON tenant_logistic_credentials
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_tenant_isolation_policy ON tenant_logistic_credentials;');
  pgm.sql('DROP TABLE IF EXISTS tenant_logistic_credentials CASCADE;');
  
  pgm.sql('DROP POLICY IF EXISTS inventory_tenant_isolation_policy ON inventory;');
  pgm.sql('DROP TABLE IF EXISTS inventory CASCADE;');

  pgm.sql('DROP POLICY IF EXISTS locations_tenant_isolation_policy ON locations;');
  pgm.sql('DROP TABLE IF EXISTS locations CASCADE;');
}

