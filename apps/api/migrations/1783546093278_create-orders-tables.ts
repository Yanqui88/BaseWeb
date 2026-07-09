import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. TABLA: orders
  //    Almacena el encabezado de cada pedido. Conecta con Mercado Pago via
  //    mp_transaction_id, con la logística via shipping_* y con el depósito
  //    que despacha via location_id. Aislamiento multi-tenant con RLS.
  // ──────────────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE orders (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      location_id              UUID NOT NULL REFERENCES locations(id),

      -- Datos del comprador (Guest Checkout — sin registro obligatorio)
      customer_email           VARCHAR(255) NOT NULL,
      customer_name            VARCHAR(255) NOT NULL,
      customer_phone           VARCHAR(50),
      customer_document        VARCHAR(50),

      -- Estado general de la orden
      -- Valores esperados: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
      status                   VARCHAR(50) NOT NULL DEFAULT 'pending',

      -- Estado del pago (espeja el estado reportado por Mercado Pago vía Webhook)
      -- Valores esperados: 'pending' | 'approved' | 'rejected' | 'refunded' | 'in_process'
      payment_status           VARCHAR(50) NOT NULL DEFAULT 'pending',

      -- ID de la preferencia/transacción en Mercado Pago para cruce de Webhooks
      mp_transaction_id        VARCHAR(255),

      -- Logística y envío
      -- shipping_method: 'pickup' | 'andreani_standard' | 'andreani_express' | 'moto_local'
      shipping_method          VARCHAR(100),
      -- shipping_status: 'pending' | 'label_generated' | 'in_transit' | 'ready_for_pickup' | 'delivered'
      shipping_status          VARCHAR(50) NOT NULL DEFAULT 'pending',
      shipping_tracking_number VARCHAR(255),
      -- Dirección de entrega almacenada como JSONB para máxima flexibilidad
      -- Estructura esperada: { street, number, floor, city, state, zip_code, country }
      shipping_address         JSONB,

      -- Importes (DECIMAL(12,2) para 12 dígitos en total, 2 decimales)
      subtotal                 DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      shipping_cost            DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      total                    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

      created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Índices para búsquedas frecuentes
  pgm.sql('CREATE INDEX orders_tenant_id_idx ON orders(tenant_id);');
  pgm.sql('CREATE INDEX orders_mp_transaction_id_idx ON orders(mp_transaction_id) WHERE mp_transaction_id IS NOT NULL;');
  pgm.sql('CREATE INDEX orders_customer_email_idx ON orders(tenant_id, customer_email);');
  pgm.sql('CREATE INDEX orders_status_idx ON orders(tenant_id, status);');

  // RLS para orders
  pgm.sql('ALTER TABLE orders ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE orders FORCE ROW LEVEL SECURITY;');

  pgm.sql(`
    CREATE POLICY orders_tenant_isolation_policy ON orders
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TABLA: order_items
  //    Líneas de detalle de cada pedido. Referencia al producto y variante
  //    comprado, con precio unitario congelado al momento de la compra
  //    (no puede cambiar si el precio del producto cambia a futuro).
  //    tenant_id duplicado aquí es REQUERIDO para que las políticas RLS
  //    puedan filtrar directamente sin necesidad de un JOIN.
  // ──────────────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE order_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id   UUID NOT NULL REFERENCES products(id),

      -- variant_id es opcional: NULL si el producto no tiene variantes
      variant_id   UUID REFERENCES variants(id),

      quantity     INTEGER NOT NULL CHECK (quantity > 0),

      -- Precio congelado al momento de la compra (inmutable históricamente)
      unit_price   DECIMAL(12, 2) NOT NULL,
      subtotal     DECIMAL(12, 2) NOT NULL
    );
  `);

  // Índices para order_items
  pgm.sql('CREATE INDEX order_items_order_id_idx ON order_items(order_id);');
  pgm.sql('CREATE INDEX order_items_tenant_id_idx ON order_items(tenant_id);');

  // RLS para order_items
  pgm.sql('ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE order_items FORCE ROW LEVEL SECURITY;');

  pgm.sql(`
    CREATE POLICY order_items_tenant_isolation_policy ON order_items
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Eliminamos en orden inverso para respetar las dependencias de FK
  pgm.sql('DROP POLICY IF EXISTS order_items_tenant_isolation_policy ON order_items;');
  pgm.sql('DROP TABLE IF EXISTS order_items CASCADE;');

  pgm.sql('DROP POLICY IF EXISTS orders_tenant_isolation_policy ON orders;');
  pgm.sql('DROP TABLE IF EXISTS orders CASCADE;');
}
