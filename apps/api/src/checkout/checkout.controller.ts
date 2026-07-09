/**
 * @file checkout.controller.ts
 * @description Controlador NestJS que expone el endpoint de creación de preferencia de pago.
 *
 * **Endpoint:** `POST /checkout/preference`
 *
 * Este endpoint es consumido directamente por el frontend de la tienda pública (apps/store).
 * Requiere que el cliente envíe el header `x-tenant-domain` con el dominio de la tienda,
 * que el `PublicTenantInterceptor` usará para resolver el `tenantId` e inyectarlo en el
 * contexto RLS del `AsyncLocalStorage` antes de que el servicio ejecute cualquier query.
 *
 * **Seguridad:**
 * - El interceptor `PublicTenantInterceptor` lanza `NotFoundException` si el header no existe
 *   o si el dominio no corresponde a ningún tenant registrado.
 * - Las queries de DB están automáticamente aisladas por tenant gracias al RLS de PostgreSQL.
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';
import { randomUUID } from 'crypto';

/** Estructura de un ítem de compra enviado por el frontend. */
export interface CheckoutItem {
  /** Nombre o título del producto. */
  title: string;
  /** Cantidad de unidades. */
  quantity: number;
  /** Precio unitario del producto. */
  unit_price: number;
}

/** Datos del comprador enviados por el frontend. */
export interface CheckoutCustomer {
  /** Email del comprador, requerido por Mercado Pago para la preferencia. */
  email: string;
}

/** Cuerpo esperado en `POST /checkout/preference`. */
export interface CreatePreferenceDto {
  /** Lista de productos a incluir en la preferencia de pago. */
  items: CheckoutItem[];
  /** Datos del cliente comprador. */
  customer: CheckoutCustomer;
}

@UseInterceptors(PublicTenantInterceptor)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Crea una preferencia de pago en Mercado Pago (path directo, sin orden en DB).
   * Para el flujo completo de Guest Checkout, usar POST /orders.
   *
   * @param body         - Items del carrito y datos del comprador.
   * @param tenantDomain - Dominio del tenant (header x-tenant-domain).
   * @returns El `init_point` de Mercado Pago para redirigir al usuario.
   */
  @Post('preference')
  @HttpCode(HttpStatus.CREATED)
  async createPreference(
    @Body() body: CreatePreferenceDto,
    @Headers('x-tenant-domain') tenantDomain: string,
  ): Promise<{ init_point: string }> {
    const tempOrderId = randomUUID();
    const result = await this.checkoutService.createPreference(
      tempOrderId,
      body.items,
      body.customer,
      tenantDomain ?? 'localhost',
    );
    return { init_point: result.initPoint };
  }
}
