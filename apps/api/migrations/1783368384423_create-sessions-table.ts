import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Crear la tabla sessions con llave foránea compuesta a users
  pgm.sql(`
    CREATE TABLE sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      token VARCHAR NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id, tenant_id) REFERENCES users(id, tenant_id) ON DELETE CASCADE
    );
  `);

  // RLS para la tabla sessions
  pgm.sql('ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE sessions FORCE ROW LEVEL SECURITY;');

  // Política RLS para aislamiento de tenants
  pgm.sql(`
    CREATE POLICY sessions_tenant_isolation_policy ON sessions
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR
        current_setting('app.is_superadmin', true) = 'true'
      );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY IF EXISTS sessions_tenant_isolation_policy ON sessions;');
  pgm.sql('DROP TABLE IF EXISTS sessions;');
}

