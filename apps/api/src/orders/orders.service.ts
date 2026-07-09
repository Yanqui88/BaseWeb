/**
 * @file orders.service.ts
 * @description Servicio de gestión de órdenes de compra del sistema multi-tenant.
 *
 * Arquitectura clave:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **SQL Puro**: Todas las operaciones usan el método `db.transaction()` o
 *    `db.query()` del `DbService`. Prohibido el uso de cualquier ORM.
 *
 * 2. **RLS Automático**: Al estar el contexto de tenant inyectado en el
 *    `AsyncLocalStorage` por el `PublicTenantInterceptor`, el `DbService` aplica
 *    automáticamente los `SET LOCAL` de RLS antes de cada consulta. Este
 *    servicio NO necesita filtrar por `tenant_id` manualmente en los WHERE;
 *    el motor Postgres lo hace a nivel de política.
 *    IMPORTANTE: tenant_id SÍ debe incluirse en los INSERT para satisfacer
 *    la cláusula WITH CHECK de las políticas RLS.
 *
 * 3. **Transacciones Atómicas**: La creación de una orden involucra múltiples
 *    tablas (`orders` + `order_items`). Se usa `db.transaction()` que garantiza
 *    que todo se inserta en una única transacción BEGIN/COMMIT, o se hace
 *    ROLLBACK si cualquier paso falla.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderRow, OrderDetailRow } from './orders.types.js';

/** Fila mínima de usuario del tenant para notificaciones. */
interface UserEmailRow {
  email: string;
  name: string | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly db: DbService,
    private readonly checkoutService: CheckoutService,
    private readonly emailService: EmailService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // CREACIÓN DE ORDEN
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Crea una orden completa de forma atómica e inmediatamente genera la
   * preferencia de pago en Mercado Pago.
   *
   * Flujo interno:
   * 1. INSERT en `orders` con estado 'pending'.
   * 2. INSERT en `order_items` por cada ítem.
   * 3. Llama a CheckoutService.createPreference para obtener initPoint y preferenceId.
   * 4. Actualiza la orden con el preferenceId como mp_transaction_id.
   * 5. Retorna la orden con initPoint.
   *
   * @param tenantId    - El UUID del tenant activo, leído del contexto ALS.
   * @param dto         - DTO validado con los datos de la orden y sus ítems.
   * @param tenantDomain - Dominio del tenant para configurar las back_urls de MP.
   * @returns La orden recién creada con `initPoint` para redirigir al comprador.
   */
  async createOrder(
    tenantId: string,
    dto: CreateOrderDto,
    tenantDomain: string,
  ): Promise<OrderRow & { initPoint: string }> {
    this.logger.log(`Creando orden para tenant ${tenantId}, cliente: ${dto.customerEmail}`);

    // ── Paso 1 y 2: Insertar orden e ítems en una transacción atómica ────────
    const newOrder = await this.db.transaction(async (client) => {
      const orderResult = await client.query<OrderRow>(
        `INSERT INTO orders (
          tenant_id,
          location_id,
          customer_email,
          customer_name,
          customer_phone,
          customer_document,
          status,
          payment_status,
          mp_transaction_id,
          shipping_method,
          shipping_status,
          shipping_tracking_number,
          shipping_address,
          subtotal,
          shipping_cost,
          total
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          'pending', 'pending',
          $7, $8, 'pending', NULL,
          $9, $10, $11, $12
        ) RETURNING *`,
        [
          tenantId,
          dto.locationId,
          dto.customerEmail,
          dto.customerName,
          dto.customerPhone ?? null,
          dto.customerDocument ?? null,
          null, // mp_transaction_id se actualiza después de obtener el preferenceId de MP
          dto.shippingMethod ?? null,
          dto.shippingAddress ? JSON.stringify(dto.shippingAddress) : null,
          dto.subtotal,
          dto.shippingCost,
          dto.total,
        ],
      );

      const order = orderResult.rows[0];
      if (!order) {
        throw new InternalServerErrorException('No se pudo crear la orden.');
      }

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await client.query(
            `INSERT INTO order_items (
              tenant_id,
              order_id,
              product_id,
              variant_id,
              quantity,
              unit_price,
              subtotal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              tenantId,
              order.id,
              item.productId,
              item.variantId ?? null,
              item.quantity,
              item.unitPrice,
              item.quantity * item.unitPrice,
            ],
          );
        }
      }

      return order;
    });

    // ── Paso 3: Crear la preferencia de pago en Mercado Pago ──────────────────
    // Se ejecuta fuera de la transacción para evitar mantenerla abierta
    // durante la llamada HTTP a la API de MP.
    let initPoint: string;
    let preferenceId: string;

    try {
      // Construir los items para MP a partir del DTO
      const mpItems = dto.items.map((item) => ({
        title: `Producto x${item.quantity}`,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      // Añadir el costo de envío como ítem separado si corresponde
      if (dto.shippingCost > 0) {
        mpItems.push({
          title: `Envío - ${dto.shippingMethod ?? 'Estándar'}`,
          quantity: 1,
          unit_price: dto.shippingCost,
        });
      }

      const mpResult = await this.checkoutService.createPreference(
        newOrder.id,
        mpItems,
        { email: dto.customerEmail },
        tenantDomain,
      );
      initPoint = mpResult.initPoint;
      preferenceId = mpResult.preferenceId;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[Orden: ${newOrder.id}] Error al crear preferencia en MP: ${error.message}. ` +
          `La orden fue creada pero sin initPoint.`,
      );
      // Retornamos la orden sin initPoint para que el cliente pueda reintentar
      return { ...newOrder, initPoint: '' };
    }

    // ── Paso 4: Guardar el preferenceId en la columna mp_transaction_id ───────
    await this.db.query(
      `UPDATE orders SET mp_transaction_id = $1, updated_at = NOW() WHERE id = $2`,
      [preferenceId, newOrder.id],
    );

    this.logger.log(`Orden creada exitosamente: ${newOrder.id}. MP Preference: ${preferenceId}`);
    return { ...newOrder, mp_transaction_id: preferenceId, initPoint };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LECTURA DE ÓRDENES
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve la lista paginada de órdenes del tenant activo.
   * RLS garantiza automáticamente que solo se retornan órdenes de este tenant.
   */
  async findAll(page = 1, limit = 20): Promise<OrderRow[]> {
    const offset = (page - 1) * limit;
    const result = await this.db.query<OrderRow>(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  /**
   * Devuelve el detalle completo de una orden, incluyendo sus ítems.
   * RLS garantiza automáticamente que solo se puede acceder a órdenes del tenant activo.
   */
  async findOneWithItems(orderId: string): Promise<OrderDetailRow> {
    const orderResult = await this.db.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId],
    );

    const order = orderResult.rows[0];
    if (!order) {
      throw new NotFoundException(`Orden ${orderId} no encontrada.`);
    }

    const itemsResult = await this.db.query(
      `SELECT
        oi.*,
        p.title AS product_title,
        p.slug  AS product_slug
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId],
    );

    return { ...order, items: itemsResult.rows };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACTUALIZACIÓN DE ESTADO (usada por Webhooks de MP y Andreani)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza el `payment_status` de una orden al recibir un Webhook de MP.
   * Cuando el estado sea 'approved', dispara las notificaciones de email.
   *
   * @param orderId         - UUID de la orden (external_reference de MP).
   * @param paymentStatus   - Nuevo estado del pago reportado por MP.
   * @param mpPaymentId     - ID real del pago en MP (para guardarlo en la orden).
   */
  async updatePaymentStatus(
    orderId: string,
    paymentStatus: string,
    mpPaymentId?: string,
  ): Promise<void> {
    // Si mpPaymentId viene definido, lo guardamos como el ID de pago real.
    // Si no, conservamos el mp_transaction_id existente (el preferenceId).
    if (mpPaymentId) {
      await this.db.query(
        `UPDATE orders
         SET payment_status    = $1,
             mp_transaction_id = $2,
             updated_at        = NOW()
         WHERE id = $3`,
        [paymentStatus, mpPaymentId, orderId],
      );
    } else {
      await this.db.query(
        `UPDATE orders
         SET payment_status = $1,
             updated_at     = NOW()
         WHERE id = $2`,
        [paymentStatus, orderId],
      );
    }

    this.logger.log(
      `Orden ${orderId} actualizada a payment_status=${paymentStatus}` +
        (mpPaymentId ? ` (mpPaymentId: ${mpPaymentId})` : ''),
    );

    // ── Notificaciones por email al aprobar el pago ───────────────────────────
    if (paymentStatus === 'approved') {
      // Disparar notificaciones de forma fire-and-forget
      this.sendPaymentApprovedEmails(orderId).catch((err: Error) => {
        this.logger.error(
          `[Orden: ${orderId}] Error al enviar emails de confirmación: ${err.message}`,
        );
      });
    }
  }

  /**
   * Envía correos de confirmación al comprador y a los administradores del tenant
   * cuando un pago es aprobado.
   */
  private async sendPaymentApprovedEmails(orderId: string): Promise<void> {
    // Obtener la orden con contexto SUPERADMIN para poder leer datos sin RLS
    // (este método se llama desde updatePaymentStatus que ya tiene contexto de tenant)
    const orderResult = await this.db.query<OrderRow>(
      `SELECT id, customer_email, customer_name, total, shipping_method, tenant_id FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = orderResult.rows[0];
    if (!order) return;

    const totalFormatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(Number(order.total));

    // Email al comprador
    const buyerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #e2e8f0; padding: 40px; border-radius: 16px;">
        <h1 style="color: #60a5fa; margin-bottom: 8px;">¡Tu compra fue confirmada! 🎉</h1>
        <p style="color: #94a3b8; margin-bottom: 24px;">Hola ${order.customer_name}, tu pago fue procesado exitosamente.</p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0;"><strong>Número de Orden:</strong> #${order.id.slice(-8).toUpperCase()}</p>
          <p style="margin: 0 0 8px 0;"><strong>Total:</strong> ${totalFormatted}</p>
          <p style="margin: 0;"><strong>Método de envío:</strong> ${order.shipping_method ?? 'A confirmar'}</p>
        </div>
        <p style="color: #64748b; font-size: 14px;">Recibirás actualizaciones sobre el estado de tu envío.</p>
      </div>
    `;

    await this.emailService.send({
      to: order.customer_email,
      subject: `✅ ¡Compra confirmada! Orden #${order.id.slice(-8).toUpperCase()}`,
      html: buyerHtml,
    });

    // Email a los administradores del tenant
    const adminsResult = await this.db.query<UserEmailRow>(
      `SELECT email, name FROM users WHERE tenant_id = $1`,
      [order.tenant_id],
    );

    if (adminsResult.rows.length > 0) {
      const adminEmails = adminsResult.rows.map((u) => u.email);
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #e2e8f0; padding: 40px; border-radius: 16px;">
          <h1 style="color: #34d399; margin-bottom: 8px;">🛒 ¡Nueva venta aprobada!</h1>
          <p style="color: #94a3b8; margin-bottom: 24px;">El cliente <strong>${order.customer_name}</strong> (${order.customer_email}) realizó una compra.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>Orden:</strong> #${order.id.slice(-8).toUpperCase()}</p>
            <p style="margin: 0 0 8px 0;"><strong>Total:</strong> ${totalFormatted}</p>
            <p style="margin: 0;"><strong>Envío:</strong> ${order.shipping_method ?? 'A confirmar'}</p>
          </div>
        </div>
      `;

      await this.emailService.send({
        to: adminEmails,
        subject: `🛒 Nueva venta - Orden #${order.id.slice(-8).toUpperCase()} (${totalFormatted})`,
        html: adminHtml,
      });
    }
  }

  /**
   * Actualiza el `shipping_status` y el `tracking_number` de una orden.
   * Usado por el Webhook de Andreani o manualmente desde el panel de admin.
   *
   * @param orderId         - UUID de la orden.
   * @param shippingStatus  - Nuevo estado logístico del envío.
   * @param trackingNumber  - Número de seguimiento asignado por el correo (opcional).
   */
  async updateShippingStatus(
    orderId: string,
    shippingStatus: string,
    trackingNumber?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE orders
       SET shipping_status          = $1,
           shipping_tracking_number = COALESCE($2, shipping_tracking_number),
           updated_at               = NOW()
       WHERE id = $3`,
      [shippingStatus, trackingNumber ?? null, orderId],
    );
    this.logger.log(`Envío de orden ${orderId} actualizado a shipping_status=${shippingStatus}`);
  }
}
