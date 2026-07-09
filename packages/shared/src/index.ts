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
