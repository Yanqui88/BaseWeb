import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/**
 * Migración de optimización de índices para alta concurrencia.
 *
 * Auditoría realizada sobre todas las migraciones del esquema. Se agregan
 * índices en:
 *  - Llaves foráneas (FK) sin índice explícito (PostgreSQL NO crea índices
 *    automáticos sobre FKs, solo sobre PKs y columnas UNIQUE).
 *  - Columnas de búsqueda frecuente (domain, slug, status, expires_at).
 *  - Columnas de resolución inversa para Webhooks (mp_transaction_id ya existe,
 *    shipping_tracking_number y mp_preapproval_id son añadidos aquí).
 *
 * ÍNDICES YA EXISTENTES (no duplicados):
 *   orders_tenant_id_idx, orders_mp_transaction_id_idx,
 *   orders_customer_email_idx, orders_status_idx,
 *   order_items_order_id_idx, order_items_tenant_id_idx
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ─────────────────────────────────────────────
  // TABLA: tenants
  // domain: usado en cada request HTTP para resolver el tenant (hot path)
  // slug:   búsqueda de tenant por slug en rutas públicas
  // ─────────────────────────────────────────────
  pgm.createIndex('tenants', 'domain', { name: 'tenants_domain_idx' });
  pgm.createIndex('tenants', 'slug', { name: 'tenants_slug_idx' });

  // ─────────────────────────────────────────────
  // TABLA: users
  // tenant_id: FK para listar usuarios por tenant (admin panel)
  // ─────────────────────────────────────────────
  pgm.createIndex('users', 'tenant_id', { name: 'users_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: home_banners
  // tenant_id: FK para listar banners activos por tenant en el storefront
  // ─────────────────────────────────────────────
  pgm.createIndex('home_banners', 'tenant_id', { name: 'home_banners_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: products
  // tenant_id: FK para listados y filtros del catálogo (alta frecuencia)
  // status:    filtro por estado (DRAFT/ACTIVE/ARCHIVED) con RLS activo
  // ─────────────────────────────────────────────
  pgm.createIndex('products', 'tenant_id', { name: 'products_tenant_id_idx' });
  pgm.createIndex('products', ['tenant_id', 'status'], { name: 'products_tenant_status_idx' });

  // ─────────────────────────────────────────────
  // TABLA: product_options
  // product_id: FK para listar las opciones de un producto (ej. Talla, Color)
  // tenant_id:  FK para aislamiento con RLS
  // ─────────────────────────────────────────────
  pgm.createIndex('product_options', 'product_id', { name: 'product_options_product_id_idx' });
  pgm.createIndex('product_options', 'tenant_id', { name: 'product_options_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: product_option_values
  // option_id: FK para listar los valores de una opción (ej. S, M, L)
  // ─────────────────────────────────────────────
  pgm.createIndex('product_option_values', 'option_id', { name: 'product_option_values_option_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: variants
  // product_id: FK para listar variantes de un producto (muy frecuente)
  // tenant_id:  FK para aislamiento con RLS
  // ─────────────────────────────────────────────
  pgm.createIndex('variants', 'product_id', { name: 'variants_product_id_idx' });
  pgm.createIndex('variants', 'tenant_id', { name: 'variants_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: variant_option_values
  // option_value_id: FK secundaria (variant_id ya es parte del PK compuesto)
  // ─────────────────────────────────────────────
  pgm.createIndex('variant_option_values', 'option_value_id', { name: 'variant_option_values_option_value_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: locations
  // tenant_id: FK para listar depósitos/sucursales por tenant
  // ─────────────────────────────────────────────
  pgm.createIndex('locations', 'tenant_id', { name: 'locations_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: inventory
  // tenant_id:          FK para aislamiento con RLS
  // product_variant_id: FK para consultas de stock por variante (hot path en checkout)
  // location_id:        FK para consultas de stock por depósito
  // ─────────────────────────────────────────────
  pgm.createIndex('inventory', 'tenant_id', { name: 'inventory_tenant_id_idx' });
  pgm.createIndex('inventory', 'product_variant_id', { name: 'inventory_product_variant_id_idx' });
  pgm.createIndex('inventory', 'location_id', { name: 'inventory_location_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: sessions
  // tenant_id:  FK para aislamiento con RLS
  // user_id:    FK para listar sesiones activas de un usuario
  // expires_at: columna usada para purgar sesiones vencidas (job programado)
  // ─────────────────────────────────────────────
  pgm.createIndex('sessions', 'tenant_id', { name: 'sessions_tenant_id_idx' });
  pgm.createIndex('sessions', 'user_id', { name: 'sessions_user_id_idx' });
  pgm.createIndex('sessions', 'expires_at', { name: 'sessions_expires_at_idx' });

  // ─────────────────────────────────────────────
  // TABLA: tenant_mp_credentials
  // tenant_id: FK para lookup de credenciales MP al iniciar flujo de pago
  //            (UNIQUE implica un índice de unicidad, pero añadimos índice
  //             nombrado explícito para claridad y monitoreo en pg_stat_user_indexes)
  // ─────────────────────────────────────────────
  pgm.createIndex('tenant_mp_credentials', 'tenant_id', { name: 'tenant_mp_credentials_tenant_id_idx' });

  // ─────────────────────────────────────────────
  // TABLA: tenant_subscriptions
  // tenant_id:       FK para consultar el plan activo del tenant
  // mp_preapproval_id: resolución inversa desde Webhooks de suscripciones MP
  // ─────────────────────────────────────────────
  pgm.createIndex('tenant_subscriptions', 'tenant_id', { name: 'tenant_subscriptions_tenant_id_idx' });
  pgm.createIndex('tenant_subscriptions', 'mp_preapproval_id', {
    name: 'tenant_subscriptions_mp_preapproval_id_idx',
    where: 'mp_preapproval_id IS NOT NULL',
  });

  // ─────────────────────────────────────────────
  // TABLA: mp_transactions
  // tenant_id: FK para aislamiento con RLS
  // order_id:  FK para asociar transacciones a órdenes (resolución inversa)
  // ─────────────────────────────────────────────
  pgm.createIndex('mp_transactions', 'tenant_id', { name: 'mp_transactions_tenant_id_idx' });
  pgm.createIndex('mp_transactions', 'order_id', {
    name: 'mp_transactions_order_id_idx',
    where: 'order_id IS NOT NULL',
  });

  // ─────────────────────────────────────────────
  // TABLA: orders
  // (tenant_id, mp_transaction_id, customer_email, status YA TIENEN índices)
  // location_id:              FK del depósito que despacha
  // shipping_status:          filtro operativo para dashboard de logística
  // shipping_tracking_number: resolución inversa desde Webhooks de Andreani/logística
  // ─────────────────────────────────────────────
  pgm.createIndex('orders', 'location_id', { name: 'orders_location_id_idx' });
  pgm.createIndex('orders', ['tenant_id', 'shipping_status'], { name: 'orders_tenant_shipping_status_idx' });
  pgm.createIndex('orders', 'shipping_tracking_number', {
    name: 'orders_shipping_tracking_number_idx',
    where: 'shipping_tracking_number IS NOT NULL',
  });

  // ─────────────────────────────────────────────
  // TABLA: order_items
  // (order_id y tenant_id YA TIENEN índices)
  // product_id: FK para reportes de ventas por producto
  // variant_id: FK para reportes de ventas por variante
  // ─────────────────────────────────────────────
  pgm.createIndex('order_items', 'product_id', { name: 'order_items_product_id_idx' });
  pgm.createIndex('order_items', 'variant_id', {
    name: 'order_items_variant_id_idx',
    where: 'variant_id IS NOT NULL',
  });

  // ─────────────────────────────────────────────
  // TABLA: tenant_logistic_credentials
  // tenant_id: FK para lookup de credenciales al despachar envíos
  // ─────────────────────────────────────────────
  pgm.createIndex('tenant_logistic_credentials', 'tenant_id', { name: 'tenant_logistic_credentials_tenant_id_idx' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Eliminamos en orden inverso al de creación

  // tenant_logistic_credentials
  pgm.dropIndex('tenant_logistic_credentials', 'tenant_id', { name: 'tenant_logistic_credentials_tenant_id_idx' });

  // order_items
  pgm.dropIndex('order_items', 'variant_id', { name: 'order_items_variant_id_idx' });
  pgm.dropIndex('order_items', 'product_id', { name: 'order_items_product_id_idx' });

  // orders
  pgm.dropIndex('orders', 'shipping_tracking_number', { name: 'orders_shipping_tracking_number_idx' });
  pgm.dropIndex('orders', ['tenant_id', 'shipping_status'], { name: 'orders_tenant_shipping_status_idx' });
  pgm.dropIndex('orders', 'location_id', { name: 'orders_location_id_idx' });

  // mp_transactions
  pgm.dropIndex('mp_transactions', 'order_id', { name: 'mp_transactions_order_id_idx' });
  pgm.dropIndex('mp_transactions', 'tenant_id', { name: 'mp_transactions_tenant_id_idx' });

  // tenant_subscriptions
  pgm.dropIndex('tenant_subscriptions', 'mp_preapproval_id', { name: 'tenant_subscriptions_mp_preapproval_id_idx' });
  pgm.dropIndex('tenant_subscriptions', 'tenant_id', { name: 'tenant_subscriptions_tenant_id_idx' });

  // tenant_mp_credentials
  pgm.dropIndex('tenant_mp_credentials', 'tenant_id', { name: 'tenant_mp_credentials_tenant_id_idx' });

  // sessions
  pgm.dropIndex('sessions', 'expires_at', { name: 'sessions_expires_at_idx' });
  pgm.dropIndex('sessions', 'user_id', { name: 'sessions_user_id_idx' });
  pgm.dropIndex('sessions', 'tenant_id', { name: 'sessions_tenant_id_idx' });

  // inventory
  pgm.dropIndex('inventory', 'location_id', { name: 'inventory_location_id_idx' });
  pgm.dropIndex('inventory', 'product_variant_id', { name: 'inventory_product_variant_id_idx' });
  pgm.dropIndex('inventory', 'tenant_id', { name: 'inventory_tenant_id_idx' });

  // locations
  pgm.dropIndex('locations', 'tenant_id', { name: 'locations_tenant_id_idx' });

  // variant_option_values
  pgm.dropIndex('variant_option_values', 'option_value_id', { name: 'variant_option_values_option_value_id_idx' });

  // variants
  pgm.dropIndex('variants', 'tenant_id', { name: 'variants_tenant_id_idx' });
  pgm.dropIndex('variants', 'product_id', { name: 'variants_product_id_idx' });

  // product_option_values
  pgm.dropIndex('product_option_values', 'option_id', { name: 'product_option_values_option_id_idx' });

  // product_options
  pgm.dropIndex('product_options', 'tenant_id', { name: 'product_options_tenant_id_idx' });
  pgm.dropIndex('product_options', 'product_id', { name: 'product_options_product_id_idx' });

  // products
  pgm.dropIndex('products', ['tenant_id', 'status'], { name: 'products_tenant_status_idx' });
  pgm.dropIndex('products', 'tenant_id', { name: 'products_tenant_id_idx' });

  // home_banners
  pgm.dropIndex('home_banners', 'tenant_id', { name: 'home_banners_tenant_id_idx' });

  // users
  pgm.dropIndex('users', 'tenant_id', { name: 'users_tenant_id_idx' });

  // tenants
  pgm.dropIndex('tenants', 'slug', { name: 'tenants_slug_idx' });
  pgm.dropIndex('tenants', 'domain', { name: 'tenants_domain_idx' });
}
