import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Tabla tenants
  pgm.sql(`
    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  // Tabla users con clave primaria compuesta
  pgm.sql(`
    CREATE TABLE users (
      id UUID NOT NULL,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      PRIMARY KEY (id, tenant_id)
    );
  `);

  // RLS para tenants
  pgm.sql('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');

  // RLS para users
  pgm.sql('ALTER TABLE users ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE users FORCE ROW LEVEL SECURITY;');

  // Política RLS para tenants
  pgm.sql(`
    CREATE POLICY tenants_tenant_isolation_policy ON tenants
      FOR ALL
      USING (
        id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // Política RLS para users
  pgm.sql(`
    CREATE POLICY users_tenant_isolation_policy ON users
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY IF EXISTS users_tenant_isolation_policy ON users;');
  pgm.sql('DROP POLICY IF EXISTS tenants_tenant_isolation_policy ON tenants;');
  pgm.sql('DROP TABLE IF EXISTS users;');
  pgm.sql('DROP TABLE IF EXISTS tenants;');
}
