/**
 * @file orders.types.ts
 * @description Tipos TypeScript que representan las filas de la base de datos
 *              para las tablas `orders` y `order_items`.
 *
 * Estos tipos reflejan exactamente las columnas de Postgres y son usados
 * como genérico en las llamadas a `db.query<T>()` del DbService.
 */

/** Representa una fila completa de la tabla `orders`. */
export interface OrderRow {
  id: string;
  tenant_id: string;
  location_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  customer_document: string | null;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'in_process';
  mp_transaction_id: string | null;
  shipping_method: 'pickup' | 'andreani_standard' | 'andreani_express' | 'moto_local' | null;
  shipping_status: 'pending' | 'label_generated' | 'in_transit' | 'ready_for_pickup' | 'delivered';
  shipping_tracking_number: string | null;
  shipping_address: ShippingAddressJson | null;
  subtotal: string; // pg retorna DECIMAL como string
  shipping_cost: string;
  total: string;
  created_at: Date;
  updated_at: Date;
}

/** Estructura JSONB del campo `shipping_address` en la tabla `orders`. */
export interface ShippingAddressJson {
  street: string;
  number: string;
  floor?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}

/** Representa una fila completa de la tabla `order_items`. */
export interface OrderItemRow {
  id: string;
  tenant_id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: string; // pg retorna DECIMAL como string
  subtotal: string;
  // Campos de JOIN con products (presentes en findOneWithItems)
  product_title?: string;
  product_slug?: string;
}

/** Orden completa con sus ítems (usada por findOneWithItems). */
export interface OrderDetailRow extends OrderRow {
  items: OrderItemRow[];
}
