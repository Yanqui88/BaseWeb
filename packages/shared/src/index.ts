export interface ShippingAddressJson {
  street: string;
  number: string;
  floor?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}

export interface Order {
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
  subtotal: string;
  shipping_cost: string;
  total: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface OrderItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  product_title?: string;
  product_slug?: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

/** Configuración visual pública de un tenant (devuelta por GET /public/tenant/config). */
export interface TenantPublicConfig {
  id: string;
  name: string;
  domain: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  whatsapp_phone: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hito 10 – Monetización SaaS: Tipos de Billing y Ciclo de Vida del Tenant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estados del ciclo de vida de la facturación de un tenant.
 *
 * Transiciones válidas (gestionadas por el Cronjob diario):
 *   trial → grace_period → suspended → deleted
 *   active → grace_period → suspended → deleted
 */
export type TenantBillingStatus =
  | 'trial'         // Período de prueba gratuito activo
  | 'active'        // Suscripción vigente y al día
  | 'grace_period'  // Pago vencido, en período de gracia antes de suspensión
  | 'suspended'     // Tenant suspendido (store offline)
  | 'deleted';      // Eliminación lógica tras suspensión extendida

/**
 * Registro de billing de un tenant.
 * Expuesto en la API del superadmin (GET /admin/tenants/:id/billing).
 */
export interface TenantBilling {
  tenant_id: string;
  status: TenantBillingStatus;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  grace_period_ends_at: string | null;
  suspended_at: string | null;
  deleted_at: string | null;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

