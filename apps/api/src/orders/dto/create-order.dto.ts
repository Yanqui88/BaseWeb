/**
 * @file create-order.dto.ts
 * @description DTO (Data Transfer Object) para la creación de una nueva orden.
 *              Validado con class-validator antes de llegar al servicio.
 */

/** Ítem individual dentro de una orden. */
export class CreateOrderItemDto {
  /** UUID del producto comprado. */
  productId!: string;

  /** UUID de la variante (si aplica). Null si el producto no tiene variantes. */
  variantId?: string | null;

  /** Cantidad de unidades compradas. Debe ser >= 1. */
  quantity!: number;

  /** Precio unitario congelado al momento de la compra (en ARS). */
  unitPrice!: number;
}

/** DTO principal para la creación de una orden completa (Guest Checkout). */
export class CreateOrderDto {
  /** UUID de la sucursal/depósito que procesa y despacha esta orden. */
  locationId!: string;

  // ── Datos del comprador ────────────────────────────────────────────────────
  customerEmail!: string;
  customerName!: string;
  customerPhone?: string;
  customerDocument?: string; // DNI / CUIT

  // ── Mercado Pago ──────────────────────────────────────────────────────────
  /** ID de preferencia de Mercado Pago para cruzar con el Webhook de pago. */
  mpTransactionId?: string;

  // ── Logística y envío ─────────────────────────────────────────────────────
  /** Método de envío seleccionado por el comprador en el checkout. */
  shippingMethod?: 'pickup' | 'andreani_standard' | 'andreani_express' | 'moto_local';

  /** Dirección de entrega (requerida si shippingMethod !== 'pickup'). */
  shippingAddress?: {
    street: string;
    number: string;
    floor?: string;
    city: string;
    state: string;
    zip_code: string;
    country?: string;
  };

  // ── Importes ──────────────────────────────────────────────────────────────
  /** Subtotal sin envío (suma de unit_price * quantity de cada ítem). */
  subtotal!: number;

  /** Costo de envío cotizado (0 si es pickup). */
  shippingCost!: number;

  /** Total final = subtotal + shippingCost. */
  total!: number;

  // ── Ítems ─────────────────────────────────────────────────────────────────
  /** Lista de productos/variantes comprados con precios congelados. */
  items!: CreateOrderItemDto[];
}
