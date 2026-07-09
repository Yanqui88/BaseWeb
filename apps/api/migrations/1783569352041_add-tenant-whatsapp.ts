import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(30) DEFAULT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE tenants DROP COLUMN IF EXISTS whatsapp_phone;`);
}
