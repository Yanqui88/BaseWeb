import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  const tables = [
    'users',
    'products',
    'variants',
    'product_options',
    'product_option_values',
    'variant_option_values',
    'inventory',
    'locations',
    'home_banners',
    'orders',
    'order_items',
    'coupons',
    'tenant_billing',
    'tenant_logistic_credentials',
    'tenant_mp_credentials',
    'tenant_subscriptions',
    'mp_transactions',
    'webhook_events'
  ];

  for (const table of tables) {
    pgm.sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const tables = [
    'users',
    'products',
    'variants',
    'product_options',
    'product_option_values',
    'variant_option_values',
    'inventory',
    'locations',
    'home_banners',
    'orders',
    'order_items',
    'coupons',
    'tenant_billing',
    'tenant_logistic_credentials',
    'tenant_mp_credentials',
    'tenant_subscriptions',
    'mp_transactions',
    'webhook_events'
  ];

  for (const table of tables) {
    pgm.sql(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY;`);
  }
}
