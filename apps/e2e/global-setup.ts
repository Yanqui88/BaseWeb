/**
 * Playwright Global Setup
 *
 * Orquesta la base de datos de prueba temporal `proyectoweb_test`:
 *  1. Conecta a la DB `postgres` (default) como superuser.
 *  2. Termina conexiones activas a `proyectoweb_test`.
 *  3. Elimina y recrea `proyectoweb_test`.
 *  4. Ejecuta las migraciones del backend via `pnpm --filter api run migrate:up`.
 *  5. Inserta la data seed inicial (tenant, location, products, inventory).
 */

import { execSync } from 'child_process';
import { Client } from 'pg';
import path from 'path';

// ─── Configuración de conexión ───────────────────────────────────────────────

const PG_USER = process.env.PG_USER ?? 'proyectoweb';
const PG_PASSWORD = process.env.PG_PASSWORD ?? 'proyectoweb';
const PG_HOST = process.env.PG_HOST ?? 'localhost';
const PG_PORT = process.env.PG_PORT ?? '5432';

const DEFAULT_DB_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/postgres`;
const TEST_DB_NAME = 'proyectoweb_test';
const TEST_DB_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${TEST_DB_NAME}`;

// Ruta raíz del monorepo (2 niveles desde apps/e2e)
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..');

// ─── Setup Global ────────────────────────────────────────────────────────────

async function globalSetup(): Promise<void> {
  console.log('\n🔧 [global-setup] Iniciando preparación de la base de datos de prueba...\n');

  // ── FASE 1: Recrear la base de datos ───────────────────────────────────────
  const adminClient = new Client({ connectionString: DEFAULT_DB_URL });
  await adminClient.connect();

  console.log(`  ➜ Terminando conexiones activas a "${TEST_DB_NAME}"...`);
  await adminClient.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid();
  `, [TEST_DB_NAME]);

  console.log(`  ➜ Eliminando base de datos "${TEST_DB_NAME}" si existe...`);
  await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);

  console.log(`  ➜ Creando base de datos "${TEST_DB_NAME}"...`);
  await adminClient.query(`CREATE DATABASE ${TEST_DB_NAME};`);

  await adminClient.end();
  console.log('  ✓ Base de datos recreada.\n');

  // ── FASE 2: Ejecutar migraciones ────────────────────────────────────────────
  console.log('  ➜ Ejecutando migraciones del backend (pnpm --filter api run migrate:up)...');
  try {
    execSync('pnpm --filter api run migrate:up', {
      cwd: MONOREPO_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
      },
    });
    console.log('  ✓ Migraciones ejecutadas.\n');
  } catch (err) {
    console.error('  ✗ Error al ejecutar migraciones:', err);
    throw err;
  }

  // ── FASE 3: Insertar data seed ─────────────────────────────────────────────
  console.log('  ➜ Insertando data seed en la base de datos de prueba...');
  const testClient = new Client({ connectionString: TEST_DB_URL });
  await testClient.connect();

  // Necesitamos omitir RLS para el seed; nos conectamos como superuser
  // y forzamos app.is_superadmin = true en la sesión.
  await testClient.query(`SET app.is_superadmin = 'true';`);

  // 3.1 Insertar Tenant
  console.log('    ➜ INSERT INTO tenants (domain = localhost)...');
  const tenantResult = await testClient.query<{ id: string }>(`
    INSERT INTO tenants (slug, name, domain)
    VALUES ('test-tenant', 'Test Tenant', 'localhost')
    RETURNING id;
  `);
  const tenantId = tenantResult.rows[0].id;
  console.log(`    ✓ Tenant creado con id: ${tenantId}`);

  // 3.2 Insertar Location (Sucursal)
  console.log('    ➜ INSERT INTO locations...');
  const locationResult = await testClient.query<{ id: string }>(`
    INSERT INTO locations (tenant_id, name, address, city, is_active)
    VALUES ($1, 'Sucursal Test', 'Av. Test 123', 'Ciudad Test', true)
    RETURNING id;
  `, [tenantId]);
  const locationId = locationResult.rows[0].id;
  console.log(`    ✓ Location creada con id: ${locationId}`);

  // 3.3 Insertar Productos
  console.log('    ➜ INSERT INTO products (2 productos)...');
  const product1Result = await testClient.query<{ id: string }>(`
    INSERT INTO products (tenant_id, title, slug, status)
    VALUES ($1, 'Producto Test Alpha', 'producto-test-alpha', 'ACTIVE')
    RETURNING id;
  `, [tenantId]);
  const product1Id = product1Result.rows[0].id;
  console.log(`    ✓ Producto 1 creado con id: ${product1Id}`);

  const product2Result = await testClient.query<{ id: string }>(`
    INSERT INTO products (tenant_id, title, slug, status)
    VALUES ($1, 'Producto Test Beta', 'producto-test-beta', 'ACTIVE')
    RETURNING id;
  `, [tenantId]);
  const product2Id = product2Result.rows[0].id;
  console.log(`    ✓ Producto 2 creado con id: ${product2Id}`);

  // 3.4 Insertar Variantes (requeridas por la tabla inventory → product_variant_id → variants)
  console.log('    ➜ INSERT INTO variants (1 por producto)...');
  const variant1Result = await testClient.query<{ id: string }>(`
    INSERT INTO variants (tenant_id, product_id, sku, title, price)
    VALUES ($1, $2, 'SKU-ALPHA-001', 'Variante Default Alpha', 1000)
    RETURNING id;
  `, [tenantId, product1Id]);
  const variant1Id = variant1Result.rows[0].id;
  console.log(`    ✓ Variante 1 creada con id: ${variant1Id}`);

  const variant2Result = await testClient.query<{ id: string }>(`
    INSERT INTO variants (tenant_id, product_id, sku, title, price)
    VALUES ($1, $2, 'SKU-BETA-001', 'Variante Default Beta', 2000)
    RETURNING id;
  `, [tenantId, product2Id]);
  const variant2Id = variant2Result.rows[0].id;
  console.log(`    ✓ Variante 2 creada con id: ${variant2Id}`);

  // 3.5 Insertar Inventory (quantity = 100 para cada variante en la sucursal)
  console.log('    ➜ INSERT INTO inventory (quantity = 100 por variante)...');
  await testClient.query(`
    INSERT INTO inventory (tenant_id, product_variant_id, location_id, quantity)
    VALUES ($1, $2, $3, 100);
  `, [tenantId, variant1Id, locationId]);
  console.log(`    ✓ Inventory para variante 1 (qty=100) en location ${locationId}`);

  await testClient.query(`
    INSERT INTO inventory (tenant_id, product_variant_id, location_id, quantity)
    VALUES ($1, $2, $3, 100);
  `, [tenantId, variant2Id, locationId]);
  console.log(`    ✓ Inventory para variante 2 (qty=100) en location ${locationId}`);

  await testClient.end();

  console.log('\n✅ [global-setup] Base de datos de prueba lista.\n');
  console.log('   Resumen del seed:');
  console.log(`   - Tenant id:     ${tenantId}  (domain: test.localhost)`);
  console.log(`   - Location id:   ${locationId}  (Sucursal Test)`);
  console.log(`   - Product 1 id:  ${product1Id}  (producto-test-alpha)`);
  console.log(`   - Product 2 id:  ${product2Id}  (producto-test-beta)`);
  console.log(`   - Variant 1 id:  ${variant1Id}  (SKU-ALPHA-001, qty=100)`);
  console.log(`   - Variant 2 id:  ${variant2Id}  (SKU-BETA-001, qty=100)\n`);
}

export default globalSetup;
