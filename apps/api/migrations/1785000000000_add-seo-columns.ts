import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS seo_og_image TEXT DEFAULT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE tenants
    DROP COLUMN IF EXISTS seo_title,
    DROP COLUMN IF EXISTS seo_description,
    DROP COLUMN IF EXISTS seo_keywords,
    DROP COLUMN IF EXISTS seo_og_image;
  `);
}
