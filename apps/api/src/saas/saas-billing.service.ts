/**
 * @file saas-billing.service.ts
 * @description Servicio de facturación SaaS via Mercado Pago Checkout Pro.
 *
 * Hito 11 – Fase 5: Billing SaaS
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsabilidades:
 *
 * 1. `createSubscriptionPreference(tenantId, userEmail)`:
 *    - Llama a la API de Mercado Pago con las credenciales MAESTRAS de la
 *      plataforma (`MP_ACCESS_TOKEN`), NO las del tenant.
 *    - Genera una preferencia de Checkout Pro por $29 USD bajo el concepto
 *      "Suscripción Mensual SaaS".
 *    - El `external_reference` es el `tenant_id` para identificar el pago
 *      en el webhook.
 *
 * 2. `processWebhook(payload)`:
 *    - Endpoint público que recibe notificaciones de MP.
 *    - Verifica el estado del pago consultando la API de MP (no confía en
 *      el payload directamente → defensa contra replay attacks).
 *    - Si `status === 'approved'`, busca el `tenant_id` en `external_reference`
 *      y actualiza `tenant_billing` con `status = 'active'` y
 *      `trial_ends_at = NOW() + 1 mes`.
 *
 * Seguridad:
 *   - El webhook no requiere JWT (es público), pero valida el pago
 *     consultando la API de MP con la clave maestra.
 *   - Responde 200 OK inmediatamente para evitar que MP reintente el envío.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DbService } from '../db/db.service.js';

/** Precio de la suscripción en USD. */
const SUBSCRIPTION_PRICE_USD = 29;

/** Concepto que aparece en la preferencia de MP. */
const SUBSCRIPTION_TITLE = 'Suscripción Mensual SaaS';

export interface CreatePreferenceResult {
  preferenceId: string;
  initPoint: string;
}

export interface MpWebhookPayload {
  action?: string;
  type?: string;
  data?: { id?: string };
  id?: string | number;
}

@Injectable()
export class SaasBillingService {
  private readonly logger = new Logger(SaasBillingService.name);

  /** Token maestro de la plataforma (nunca del tenant). */
  private get mpAccessToken(): string {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      throw new InternalServerErrorException(
        'MP_ACCESS_TOKEN no está configurado en las variables de entorno.',
      );
    }
    return token;
  }

  constructor(private readonly db: DbService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // CREAR PREFERENCIA DE CHECKOUT PRO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Crea una preferencia de Checkout Pro en Mercado Pago para la suscripción
   * mensual SaaS de $29 USD.
   *
   * @param tenantId   - UUID del tenant que inicia el pago (se guarda en external_reference).
   * @param userEmail  - Email del payer para prellenar el formulario de MP.
   * @returns          `{ preferenceId, initPoint }` para redirigir al usuario.
   * @throws InternalServerErrorException si la llamada a la API de MP falla.
   */
  async createSubscriptionPreference(
    tenantId: string,
    userEmail?: string,
  ): Promise<CreatePreferenceResult> {
    this.logger.log(
      `Creando preferencia MP para tenant_id=${tenantId}`,
    );

    const body = {
      items: [
        {
          id: 'saas-monthly-subscription',
          title: SUBSCRIPTION_TITLE,
          quantity: 1,
          unit_price: SUBSCRIPTION_PRICE_USD,
          currency_id: 'USD',
          description:
            'Acceso completo a la plataforma SaaS multi-tenant durante 30 días.',
        },
      ],
      payer: userEmail
        ? { email: userEmail }
        : undefined,
      back_urls: {
        success: `${process.env.ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=success`,
        failure: `${process.env.ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=failure`,
        pending: `${process.env.ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=pending`,
      },
      auto_return: 'approved',
      external_reference: tenantId,
      notification_url: `${process.env.API_URL || 'http://localhost:4000'}/saas/billing/webhook`,
      statement_descriptor: 'SAAS PLATAFORMA',
      expires: false,
    };

    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.mpAccessToken}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Error al crear preferencia MP: ${response.status} – ${errorText}`,
      );
      throw new InternalServerErrorException(
        'No se pudo generar la preferencia de pago en Mercado Pago.',
      );
    }

    const data = await response.json() as {
      id: string;
      init_point: string;
    };

    this.logger.log(
      `Preferencia creada: id=${data.id}, tenant=${tenantId}`,
    );

    return {
      preferenceId: data.id,
      initPoint: data.init_point,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROCESAR WEBHOOK DE MERCADO PAGO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Procesa la notificación de pago recibida de Mercado Pago.
   *
   * ⚠️  SEGURIDAD: No confiamos en el payload de MP directamente.
   * Siempre verificamos el estado del pago consultando la API de MP
   * con el `payment_id` extraído del webhook (anti-replay attack).
   *
   * Si el pago está `approved`, actualiza `tenant_billing`:
   *   - `status = 'active'`
   *   - `trial_ends_at = NOW() + INTERVAL '1 month'`
   *   - `updated_at = NOW()`
   *
   * @param payload - Cuerpo del webhook enviado por MP.
   * @returns `{ received: true }` siempre, para responder 200 OK rápido.
   */
  async processWebhook(payload: MpWebhookPayload): Promise<{ received: boolean }> {
    // Extraer el ID del pago del payload (puede venir en distintos campos
    // según el tipo de notificación: IPN vs. Webhooks modernos).
    const paymentId =
      payload?.data?.id ??
      (payload?.id !== undefined ? String(payload.id) : undefined);

    const notificationType = payload?.type ?? payload?.action ?? 'unknown';

    this.logger.log(
      `Webhook MP recibido: type=${notificationType}, paymentId=${paymentId ?? 'N/A'}`,
    );

    // Solo procesamos notificaciones de tipo 'payment'
    if (notificationType !== 'payment' && payload?.action !== 'payment.created' && payload?.action !== 'payment.updated') {
      this.logger.debug(
        `Notificación ignorada (tipo no es payment): type=${notificationType}`,
      );
      return { received: true };
    }

    if (!paymentId) {
      this.logger.warn('Webhook sin paymentId, ignorado.');
      return { received: true };
    }

    // ── Verificar el pago en la API de MP (anti-replay) ───────────────────
    let tenantId: string | undefined;

    try {
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${this.mpAccessToken}`,
          },
        },
      );

      if (!mpResponse.ok) {
        this.logger.warn(
          `No se pudo verificar el pago ${paymentId} en MP: ${mpResponse.status}`,
        );
        return { received: true };
      }

      const payment = await mpResponse.json() as {
        status: string;
        external_reference?: string;
      };

      this.logger.log(
        `Pago ${paymentId}: status=${payment.status}, external_reference=${payment.external_reference}`,
      );

      if (payment.status !== 'approved') {
        this.logger.debug(
          `Pago ${paymentId} no aprobado (status=${payment.status}), sin acción.`,
        );
        return { received: true };
      }

      tenantId = payment.external_reference;
    } catch (error) {
      this.logger.error(
        `Error al consultar API de MP para pago ${paymentId}:`,
        error,
      );
      // Respondemos 200 igualmente para que MP no reintente
      return { received: true };
    }

    if (!tenantId) {
      this.logger.warn(
        `Pago ${paymentId} aprobado pero sin external_reference (tenant_id).`,
      );
      return { received: true };
    }

    // ── Actualizar tenant_billing en la base de datos ─────────────────────
    try {
      const result = await this.db.queryRaw<{ id: string }>(
        `UPDATE tenant_billing
         SET
           status         = 'active',
           trial_ends_at  = NOW() + INTERVAL '1 month',
           updated_at     = NOW()
         WHERE tenant_id = $1
         RETURNING tenant_id`,
        [tenantId],
      );

      if (result.rows.length === 0) {
        this.logger.warn(
          `No se encontró tenant_billing para tenant_id=${tenantId}. ` +
          `Se intentará crear el registro.`,
        );

        // Crear registro de billing si no existe (edge case: registro eliminado)
        await this.db.queryRaw(
          `INSERT INTO tenant_billing (tenant_id, status, trial_ends_at, created_at, updated_at)
           VALUES ($1, 'active', NOW() + INTERVAL '1 month', NOW(), NOW())
           ON CONFLICT (tenant_id) DO UPDATE
             SET status        = 'active',
                 trial_ends_at = NOW() + INTERVAL '1 month',
                 updated_at    = NOW()`,
          [tenantId],
        );
      }

      this.logger.log(
        `✅ tenant_billing actualizado: tenant_id=${tenantId}, status=active, +1 mes.`,
      );
    } catch (dbError) {
      this.logger.error(
        `Error al actualizar tenant_billing para tenant_id=${tenantId}:`,
        dbError,
      );
      // Respondemos 200 igualmente: MP no debe reintentar por errores internos
    }

    return { received: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OBTENER ESTADO DEL BILLING DEL TENANT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el estado actual del billing del tenant autenticado.
   *
   * @param tenantId - UUID del tenant.
   * @returns Datos de billing: status, trial_ends_at, updated_at.
   */
  async getBillingStatus(tenantId: string): Promise<{
    status: string;
    trial_ends_at: string | null;
    updated_at: string | null;
    days_remaining: number | null;
  }> {
    const result = await this.db.queryRaw<{
      status: string;
      trial_ends_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT status, trial_ends_at, updated_at
       FROM tenant_billing
       WHERE tenant_id = $1
       LIMIT 1`,
      [tenantId],
    );

    if (result.rows.length === 0) {
      return {
        status: 'unknown',
        trial_ends_at: null,
        updated_at: null,
        days_remaining: null,
      };
    }

    const billing = result.rows[0];
    let days_remaining: number | null = null;

    if (billing.trial_ends_at) {
      const endDate = new Date(billing.trial_ends_at);
      const now = new Date();
      const diffMs = endDate.getTime() - now.getTime();
      days_remaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      status: billing.status,
      trial_ends_at: billing.trial_ends_at,
      updated_at: billing.updated_at,
      days_remaining,
    };
  }
}
