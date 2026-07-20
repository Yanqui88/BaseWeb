import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/**
 * Hito 8 – Seguridad y Auditoría de Webhooks
 *
 * Objetivos de esta migración:
 * 1. UNIQUE constraint en `orders.mp_transaction_id` → idempotencia a nivel SQL.
 *    Garantiza que ninguna orden se procese o descuente stock dos veces ante
 *    webhooks duplicados de Mercado Pago.
 *
 * 2. Tabla `webhook_events` → registro de auditoría de cada notificación recibida.
 *    Permite rastrear, depurar y detectar reintentos sin necesidad de parsear logs.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ────────────────────────────────────────────────────────────────────────────
  // 1. UNIQUE constraint en orders.mp_transaction_id
  //    Usamos una UNIQUE INDEX parcial (WHERE mp_transaction_id IS NOT NULL)
  //    para no afectar a las órdenes 'pending' que aún no tienen ID de MP.
  // ────────────────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_mp_transaction_id_unique_idx
      ON orders (mp_transaction_id)
      WHERE mp_transaction_id IS NOT NULL;
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 2. TABLA: webhook_events (log de auditoría)
  //    Almacena cada notificación de webhook recibida para trazabilidad total.
  //    - mp_payment_id: ID del pago en Mercado Pago (para deduplicación).
  //    - status: 'received' | 'queued' | 'processed' | 'failed' | 'duplicate'.
  //    - hmac_valid: indica si la firma criptográfica fue válida.
  // ────────────────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id      UUID REFERENCES tenants(id) ON DELETE SET NULL,
      source         VARCHAR(50)  NOT NULL DEFAULT 'mercadopago',
      mp_payment_id  VARCHAR(255),
      event_type     VARCHAR(100),
      hmac_valid     BOOLEAN      NOT NULL DEFAULT false,
      status         VARCHAR(50)  NOT NULL DEFAULT 'received',
      payload        JSONB,
      error_message  TEXT,
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  pgm.sql('CREATE INDEX webhook_events_mp_payment_id_idx ON webhook_events(mp_payment_id) WHERE mp_payment_id IS NOT NULL;');
  pgm.sql('CREATE INDEX webhook_events_created_at_idx ON webhook_events(created_at DESC);');
  pgm.sql('CREATE INDEX webhook_events_status_idx ON webhook_events(status);');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS webhook_events CASCADE;');
  pgm.sql('DROP INDEX IF EXISTS orders_mp_transaction_id_unique_idx;');
}
