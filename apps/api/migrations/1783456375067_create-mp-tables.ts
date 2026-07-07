import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // A) tenant_mp_credentials
  pgm.sql(`
    CREATE TABLE tenant_mp_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
      mp_user_id VARCHAR,
      access_token_encrypted VARCHAR NOT NULL,
      refresh_token_encrypted VARCHAR,
      public_key VARCHAR,
      linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  pgm.sql('ALTER TABLE tenant_mp_credentials ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE tenant_mp_credentials FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials 
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // B) tenant_subscriptions
  pgm.sql(`
    CREATE TABLE tenant_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      mp_preapproval_id VARCHAR,
      status VARCHAR NOT NULL DEFAULT 'pending',
      plan_name VARCHAR,
      price DECIMAL(10,2),
      start_date TIMESTAMP WITH TIME ZONE,
      end_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  pgm.sql('ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions 
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // C) mp_transactions
  pgm.sql(`
    CREATE TABLE mp_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      mp_payment_id VARCHAR NOT NULL UNIQUE,
      order_id UUID,
      status VARCHAR NOT NULL,
      status_detail VARCHAR,
      amount DECIMAL(10, 2) NOT NULL,
      currency_id VARCHAR DEFAULT 'ARS',
      payer_email VARCHAR,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  pgm.sql('ALTER TABLE mp_transactions ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE mp_transactions FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY mp_transactions_tenant_isolation_policy ON mp_transactions 
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE tenant_mp_credentials CASCADE;');
  pgm.sql('DROP TABLE tenant_subscriptions CASCADE;');
  pgm.sql('DROP TABLE mp_transactions CASCADE;');
}
