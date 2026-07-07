import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Ya creado e inicializado con RLS en 1782854968139_init-schema.ts.
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // No-op
}
