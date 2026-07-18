/**
 * @file webhooks.spec.ts
 * @description Tests End-to-End para los endpoints de Webhooks de Mercado Pago y Andreani.
 *
 * Estrategia:
 *  - Se usa el fixture `request` de Playwright para enviar POSTs directamente al backend NestJS
 *    (puerto 4000), simulando los payloads que enviarían los proveedores externos.
 *  - Antes de cada test se inserta una orden temporal en la base de datos de prueba
 *    con `mp_transaction_id = 'MP-9999'` y `shipping_tracking_number = 'AND-8888'`.
 *  - Como los endpoints responden 200 OK de forma inmediata y el procesamiento es
 *    fire-and-forget, se añade un delay para dar tiempo a la actualización.
 *  - La suite corre en modo SERIAL para evitar race conditions entre los beforeEach
 *    de ambos tests (que comparten los mismos identificadores de orden).
 *
 * Valores de estado esperados (según el schema y los mapas del servicio):
 *  - MP tipo 'payment'       → payment_status = 'approved'
 *  - Andreani 'Entregado'    → shipping_status = 'delivered'
 */

import { test, expect } from '@playwright/test';
import { Pool, PoolClient } from 'pg';

// ─── Modo serial: evita race conditions entre tests que comparten identificadores ──
test.describe.configure({ mode: 'serial' });

// ─── Configuración ───────────────────────────────────────────────────────────

/** URL de conexión a la base de datos de prueba. */
const DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://proyectoweb:proyectoweb@localhost:5432/proyectoweb_test';

/** Puerto donde corre el backend NestJS. */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Tiempo de espera (ms) para que el procesamiento asíncrono fire-and-forget
 * del webhook se complete antes de consultar la base de datos.
 */
const WEBHOOK_PROCESSING_DELAY_MS = 2000;

/** ID del tracking ficticio de Mercado Pago para la orden de prueba. */
const MP_TRANSACTION_ID = 'MP-9999';

/** Número de tracking ficticio de Andreani para la orden de prueba. */
const ANDREANI_TRACKING_NUMBER = 'AND-8888';

// ─── Suite de tests ───────────────────────────────────────────────────────────

test.describe('Webhooks — Procesamiento de notificaciones externas', () => {
  let pool: Pool;
  let orderId: string;

  // ── Conectar al pool de la DB antes de todos los tests ──────────────────────
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL });

    // Verificar conectividad
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log(`[webhooks.spec] Conectado a la base de datos de prueba: ${DB_URL}`);
  });

  // ── Cerrar el pool al finalizar todos los tests ─────────────────────────────
  test.afterAll(async () => {
    await pool.end();
    console.log('[webhooks.spec] Pool de base de datos cerrado.');
  });

  // ── Insertar una orden temporal antes de cada test ──────────────────────────
  test.beforeEach(async () => {
    const client: PoolClient = await pool.connect();

    try {
      // Activar modo superadmin para saltear RLS en la sesión de prueba
      await client.query(`SET app.is_superadmin = 'true';`);

      // Obtener el tenant_id del seed (tenant con slug='test-tenant')
      const tenantResult = await client.query<{ id: string }>(
        `SELECT id FROM tenants WHERE slug = 'test-tenant' LIMIT 1`,
      );

      if (tenantResult.rows.length === 0) {
        throw new Error(
          '[webhooks.spec] No se encontró el tenant de prueba. ' +
            'Asegúrate de haber corrido el global-setup.',
        );
      }
      const tenantId = tenantResult.rows[0].id;

      // Obtener la location_id del seed
      const locationResult = await client.query<{ id: string }>(
        `SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );

      if (locationResult.rows.length === 0) {
        throw new Error(
          '[webhooks.spec] No se encontró la location de prueba. ' +
            'Asegúrate de haber corrido el global-setup.',
        );
      }
      const locationId = locationResult.rows[0].id;

      // Limpiar órdenes de prueba anteriores con los mismos identificadores
      await client.query(
        `DELETE FROM orders
         WHERE mp_transaction_id = $1
            OR shipping_tracking_number = $2`,
        [MP_TRANSACTION_ID, ANDREANI_TRACKING_NUMBER],
      );

      // Insertar la orden temporal con los datos de prueba
      const orderResult = await client.query<{ id: string }>(
        `INSERT INTO orders (
           tenant_id,
           location_id,
           customer_email,
           customer_name,
           status,
           payment_status,
           shipping_status,
           mp_transaction_id,
           shipping_tracking_number,
           subtotal,
           shipping_cost,
           total
         )
         VALUES ($1, $2, 'webhook-test@example.com', 'Test Webhook User',
                 'pending', 'pending', 'pending', $3, $4,
                 1000.00, 500.00, 1500.00)
         RETURNING id`,
        [tenantId, locationId, MP_TRANSACTION_ID, ANDREANI_TRACKING_NUMBER],
      );

      orderId = orderResult.rows[0].id;
      console.log(
        `[webhooks.spec] Orden temporal creada — id: ${orderId}, ` +
          `tenant: ${tenantId}, location: ${locationId}`,
      );
    } finally {
      client.release();
    }
  });

  // ─── TEST 1: Webhook de Mercado Pago ────────────────────────────────────────

  test('Test 1 — Webhook MP: debe actualizar payment_status a "approved" cuando MP notifica un pago aprobado', async ({
    request,
  }) => {
    // ── 1. Enviar el payload simulado de Mercado Pago ─────────────────────────
    //
    // Formato real del webhook de Mercado Pago:
    //   - type: 'payment'  → tipo de evento (el controller solo procesa este tipo)
    //   - data.id: mp_transaction_id de la orden (MP-9999)
    //
    // El MP_STATUS_MAP del servicio mapea: 'payment' → 'approved'
    // El servicio buscará la orden por mp_transaction_id='MP-9999' y actualizará
    // payment_status = 'approved' usando el UUID real de la orden.
    const mpPayload = {
      type: 'payment',
      data: {
        id: MP_TRANSACTION_ID,
      },
    };

    console.log(`[Test 1] Enviando POST ${API_BASE_URL}/webhooks/mp`, mpPayload);

    const response = await request.post(`${API_BASE_URL}/webhooks/mp`, {
      data: mpPayload,
    });

    // El endpoint siempre responde 200 (fire-and-forget)
    expect(response.status()).toBe(200);
    console.log(`[Test 1] Respuesta del webhook MP: ${response.status()}`);

    // ── 2. Esperar el procesamiento asíncrono ─────────────────────────────────
    await new Promise<void>((resolve) => setTimeout(resolve, WEBHOOK_PROCESSING_DELAY_MS));

    // ── 3. Verificar el estado en la base de datos ────────────────────────────
    const client: PoolClient = await pool.connect();
    try {
      await client.query(`SET app.is_superadmin = 'true';`);

      const result = await client.query<{
        id: string;
        payment_status: string;
      }>(
        `SELECT id, payment_status
         FROM orders
         WHERE mp_transaction_id = $1
         LIMIT 1`,
        [MP_TRANSACTION_ID],
      );

      console.log(`[Test 1] Estado en DB:`, result.rows[0]);

      expect(result.rows.length).toBe(1);
      // El mapa MP_STATUS_MAP convierte 'payment' → 'approved'
      expect(result.rows[0].payment_status).toBe('approved');
    } finally {
      client.release();
    }
  });

  // ─── TEST 2: Webhook de Andreani ─────────────────────────────────────────────

  test('Test 2 — Webhook Andreani: debe actualizar shipping_status a "delivered" cuando Andreani notifica entrega', async ({
    request,
  }) => {
    // ── 1. Enviar el payload simulado de Andreani ─────────────────────────────
    //
    // Formato real del webhook de Andreani:
    //   - numeroDeEnvio: shipping_tracking_number de la orden (AND-8888)
    //   - estadoActual:  estado Andreani mapeado via ANDREANI_STATUS_MAP
    //
    // El ANDREANI_STATUS_MAP del servicio mapea: 'Entregado' → 'delivered'
    const andreaniPayload = {
      numeroDeEnvio: ANDREANI_TRACKING_NUMBER,
      estadoActual: 'Entregado',
    };

    console.log(
      `[Test 2] Enviando POST ${API_BASE_URL}/webhooks/andreani`,
      andreaniPayload,
    );

    const response = await request.post(`${API_BASE_URL}/webhooks/andreani`, {
      data: andreaniPayload,
    });

    // El endpoint siempre responde 200 (fire-and-forget)
    expect(response.status()).toBe(200);
    console.log(`[Test 2] Respuesta del webhook Andreani: ${response.status()}`);

    // ── 2. Esperar el procesamiento asíncrono ─────────────────────────────────
    await new Promise<void>((resolve) => setTimeout(resolve, WEBHOOK_PROCESSING_DELAY_MS));

    // ── 3. Verificar el estado en la base de datos ────────────────────────────
    const client: PoolClient = await pool.connect();
    try {
      await client.query(`SET app.is_superadmin = 'true';`);

      const result = await client.query<{
        id: string;
        shipping_status: string;
      }>(
        `SELECT id, shipping_status
         FROM orders
         WHERE shipping_tracking_number = $1
         LIMIT 1`,
        [ANDREANI_TRACKING_NUMBER],
      );

      console.log(`[Test 2] Estado en DB:`, result.rows[0]);

      expect(result.rows.length).toBe(1);
      // El mapa ANDREANI_STATUS_MAP convierte 'Entregado' → 'delivered'
      expect(result.rows[0].shipping_status).toBe('delivered');
    } finally {
      client.release();
    }
  });
});
