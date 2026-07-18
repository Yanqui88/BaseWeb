/**
 * @file webhooks.service.ts
 * @description Servicio de procesamiento de Webhooks de Mercado Pago y Andreani
 * orientado a la actualización del estado de las órdenes (`orders`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISEÑO DE SEGURIDAD (SUPERADMIN → TENANT):
 * ─────────────────────────────────────────────────────────────────────────────
 * Los webhooks de MP y Andreani llegan sin un header `x-tenant-id`, ya que son
 * peticiones externas que no conocen nuestra arquitectura multi-tenant.
 *
 * El flujo de resolución de contexto es de dos fases:
 *
 * Fase 1 - SUPERADMIN: Se activa el ALS con `{ isSuperAdmin: true }` para
 *   poder hacer un SELECT en la tabla `orders` SIN que el RLS bloquee el
 *   acceso. Esto permite buscar la orden por `mp_transaction_id` o
 *   `shipping_tracking_number`, independientemente del tenant al que pertenezca.
 *
 * Fase 2 - TENANT: Una vez obtenido el `tenant_id` de la orden encontrada, se
 *   invoca al `OrdersService` dentro de un nuevo contexto ALS acotado al
 *   tenant específico (`{ tenantId: orden.tenant_id }`), garantizando que
 *   la actualización quede aislada por RLS.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { OrdersService } from '../orders/orders.service.js';

/** Fila mínima de la tabla `orders` para resolver el tenant. */
interface OrderLookupRow {
  id: string;
  tenant_id: string;
  payment_status: string;
}

/** Mapeo de estados de Mercado Pago a los valores internos del sistema.
 *  Incluye 'payment' porque el controller pasa payload.type como mpStatus
 *  y el evento estándar de MP para pagos exitosos tiene type = 'payment'.
 */
const MP_STATUS_MAP: Record<string, string> = {
  payment: 'approved',   // evento estándar de MP: type='payment' → pago aprobado
  approved: 'approved',  // estado explícito en simulaciones/tests
  rejected: 'rejected',
  refunded: 'refunded',
};

/** Mapeo de estados de Andreani a los valores internos del sistema. */
const ANDREANI_STATUS_MAP: Record<string, string> = {
  'En camino': 'in_transit',
  'Entregado': 'delivered',
  'Listo para retirar': 'ready_for_pickup',
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly db: DbService,
    private readonly ordersService: OrdersService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // MERCADO PAGO
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Procesa un webhook de pago de Mercado Pago actualizando el estado de la
   * orden asociada en la tabla `orders`.
   *
   * El `paymentId` que llega del webhook ES el `mp_transaction_id` almacenado
   * en la orden al momento del checkout.
   *
   * @param paymentId  - ID del pago / preferencia reportado por Mercado Pago.
   * @param mpStatus   - Estado del pago reportado por MP (ej: 'approved').
   */
  async handleMercadoPagoNotification(
    paymentId: string,
    mpStatus: string,
  ): Promise<void> {
    // ── Fase 1: Buscar la orden en modo SUPERADMIN ──────────────────────────
    const order = await this.db.als.run(
      { isSuperAdmin: true },
      async () => {
        const result = await this.db.query<OrderLookupRow>(
          `SELECT id, tenant_id, payment_status
           FROM orders
           WHERE mp_transaction_id = $1
           LIMIT 1`,
          [paymentId],
        );
        return result.rows[0] ?? null;
      },
    );

    if (!order) {
      this.logger.warn(
        `[MP Webhook] No se encontró ninguna orden con mp_transaction_id="${paymentId}". ` +
          `Ignorando notificación.`,
      );
      return;
    }

    // ── Mapear el estado de MP al valor interno del sistema ──────────────────
    const mappedStatus = MP_STATUS_MAP[mpStatus] ?? 'pending';

    this.logger.log(
      `[MP Webhook] Orden ${order.id} (tenant: ${order.tenant_id}). ` +
        `MP status "${mpStatus}" → interno "${mappedStatus}".`,
    );

    // ── Fase 2: Actualizar el estado en contexto del tenant propietario ──────
    // FIX: se pasa order.id (UUID de la orden) en lugar de paymentId (mp_transaction_id),
    // ya que updatePaymentStatus busca por WHERE id = $2.
    await this.db.als.run(
      { tenantId: order.tenant_id, isSuperAdmin: false },
      async () => {
        await this.ordersService.updatePaymentStatus(order.id, mappedStatus);
      },
    );

    this.logger.log(
      `[MP Webhook] Orden ${order.id} actualizada a payment_status="${mappedStatus}" exitosamente.`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ANDREANI
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Procesa un webhook de estado logístico de Andreani actualizando el
   * `shipping_status` de la orden asociada en la tabla `orders`.
   *
   * @param numeroDeEnvio  - Número de seguimiento / envío de Andreani.
   * @param estadoActual   - Cadena de estado reportada por Andreani.
   */
  async handleAndreaniNotification(
    numeroDeEnvio: string,
    estadoActual: string,
  ): Promise<void> {
    // ── Fase 1: Buscar la orden en modo SUPERADMIN ──────────────────────────
    const order = await this.db.als.run(
      { isSuperAdmin: true },
      async () => {
        const result = await this.db.query<{ id: string; tenant_id: string }>(
          `SELECT id, tenant_id
           FROM orders
           WHERE shipping_tracking_number = $1
           LIMIT 1`,
          [numeroDeEnvio],
        );
        return result.rows[0] ?? null;
      },
    );

    if (!order) {
      this.logger.warn(
        `[Andreani Webhook] No se encontró ninguna orden con tracking_number="${numeroDeEnvio}". ` +
          `Ignorando notificación.`,
      );
      return;
    }

    // ── Mapear el estado de Andreani al valor interno del sistema ────────────
    const mappedStatus = ANDREANI_STATUS_MAP[estadoActual] ?? 'in_transit';

    this.logger.log(
      `[Andreani Webhook] Orden ${order.id} (tenant: ${order.tenant_id}). ` +
        `Andreani estado "${estadoActual}" → interno "${mappedStatus}".`,
    );

    // ── Fase 2: Actualizar el estado en contexto del tenant propietario ──────
    await this.db.als.run(
      { tenantId: order.tenant_id, isSuperAdmin: false },
      async () => {
        await this.ordersService.updateShippingStatus(order.id, mappedStatus);
      },
    );

    this.logger.log(
      `[Andreani Webhook] Orden ${order.id} actualizada a shipping_status="${mappedStatus}" exitosamente.`,
    );
  }
}
