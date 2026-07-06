import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('tenants', {
    domain: { type: 'VARCHAR', unique: true },
    primary_color: { type: 'VARCHAR(7)' },
    secondary_color: { type: 'VARCHAR(7)' },
    logo_url: { type: 'TEXT' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('tenants', ['domain', 'primary_color', 'secondary_color', 'logo_url']);
}


