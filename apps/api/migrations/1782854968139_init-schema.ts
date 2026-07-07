import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 0. Habilitar la extensión uuid-ossp si no existe
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // 1. Crear el enum de estados del producto
  pgm.sql(`CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');`);

  // 2. Tabla de Tenants
  pgm.sql(`
    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Tabla de Usuarios con clave primaria compuesta
  pgm.sql(`
    CREATE TABLE users (
      id UUID NOT NULL DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, tenant_id),
      CONSTRAINT users_tenant_email_key UNIQUE (tenant_id, email)
    );
  `);

  // 4. Tabla de Banners de Inicio
  pgm.sql(`
    CREATE TABLE home_banners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      desktop_image_url TEXT NOT NULL,
      mobile_image_url TEXT NOT NULL,
      href TEXT,
      alt TEXT,
      title TEXT,
      subtitle TEXT,
      badge TEXT,
      button_text TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      starts_at TIMESTAMP WITH TIME ZONE,
      ends_at TIMESTAMP WITH TIME ZONE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Tabla de Productos
  pgm.sql(`
    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      status "ProductStatus" DEFAULT 'DRAFT',
      cover_image TEXT,
      images TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT products_tenant_slug_key UNIQUE (tenant_id, slug)
    );
  `);

  // 6. Tabla de Opciones de Productos
  pgm.sql(`
    CREATE TABLE product_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL
    );
  `);

  // 7. Tabla de Valores de Opciones
  pgm.sql(`
    CREATE TABLE product_option_values (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
      value VARCHAR(255) NOT NULL
    );
  `);

  // 8. Tabla de Variantes de Productos
  pgm.sql(`
    CREATE TABLE variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku VARCHAR(255) NOT NULL,
      title VARCHAR(255),
      price INTEGER NOT NULL,
      compare_at INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT variants_tenant_sku_key UNIQUE (tenant_id, sku)
    );
  `);

  // 9. Tabla de Mapeo de Variantes con sus Valores de Opciones
  pgm.sql(`
    CREATE TABLE variant_option_values (
      variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      option_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
      PRIMARY KEY (variant_id, option_value_id)
    );
  `);

  // 10. Tabla de Sucursales
  pgm.sql(`
    CREATE TABLE locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      city VARCHAR(255),
      address VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT locations_tenant_name_key UNIQUE (tenant_id, name)
    );
  `);

  // 11. Tabla de Inventario de Variantes
  pgm.sql(`
    CREATE TABLE inventories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT inventories_variant_location_key UNIQUE (variant_id, location_id)
    );
  `);

  // --- HABILITAR SEGURIDAD A NIVEL DE FILA (RLS) ---
  const rlsTables = [
    'users',
    'home_banners',
    'products',
    'product_options',
    'variants',
    'locations',
    'inventories'
  ];

  for (const table of rlsTables) {
    pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    pgm.sql(`
      CREATE POLICY ${table}_tenant_isolation ON ${table}
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
    `);
  }

  // RLS para tablas secundarias mediante EXISTS (seguridad por transitividad)
  pgm.sql(`ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE product_option_values FORCE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY product_option_values_tenant_isolation ON product_option_values
      USING (EXISTS (
        SELECT 1 FROM product_options 
        WHERE product_options.id = product_option_values.option_id
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM product_options 
        WHERE product_options.id = product_option_values.option_id
      ));
  `);

  pgm.sql(`ALTER TABLE variant_option_values ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE variant_option_values FORCE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY variant_option_values_tenant_isolation ON variant_option_values
      USING (EXISTS (
        SELECT 1 FROM variants 
        WHERE variants.id = variant_option_values.variant_id
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM variants 
        WHERE variants.id = variant_option_values.variant_id
      ));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS variant_option_values CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS inventories CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS locations CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS variants CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS product_option_values CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS product_options CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS products CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS home_banners CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS users CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS tenants CASCADE;');
  pgm.sql('DROP TYPE IF EXISTS "ProductStatus" CASCADE;');
}
