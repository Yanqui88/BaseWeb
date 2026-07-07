/**
 * @file logistics.controller.ts
 * @description Controlador NestJS que expone los endpoints de logística.
 *
 * **Endpoint expuesto:**
 * - `POST /logistics/quote` → Cotiza el costo de envío para un pedido del tenant activo.
 *
 * **Seguridad:**
 * - El `PublicTenantInterceptor` (aplicado a nivel de clase) resuelve el tenant desde
 *   el header `x-tenant-domain` y activa el contexto RLS en el `AsyncLocalStorage`
 *   antes de que este método sea invocado.
 * - Las queries de DB están automáticamente aisladas por tenant gracias al RLS de PostgreSQL.
 *
 * **Validación:**
 * - El `ValidationPipe` aplicado localmente transforma y valida el body con los
 *   decoradores de `class-validator` definidos en `QuoteShippingDto`.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { LogisticsService, type ShippingQuoteResponse } from './logistics.service.js';
import { QuoteShippingDto } from './dto/quote-shipping.dto.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@UseInterceptors(PublicTenantInterceptor)
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  /**
   * Cotiza el costo de envío para los productos de un pedido.
   *
   * El `PublicTenantInterceptor` resuelve el tenant desde el header `x-tenant-domain`
   * y activa el contexto RLS. El `LogisticsService` luego obtiene el depósito origen
   * del tenant y delega la cotización real al `AndreaniService`.
   *
   * @param body - Destino del envío y lista de productos con sus dimensiones físicas.
   * @returns Las opciones de envío disponibles con tarifas en ARS y plazos en días.
   *
   * @example
   * // POST /logistics/quote
   * // Headers: { "x-tenant-domain": "mi-tienda.com" }
   * // Body:
   * {
   *   "destinationZip": "1425",
   *   "products": [
   *     { "weightGrams": 500, "heightCm": 10, "widthCm": 15, "depthCm": 5, "quantity": 2 },
   *     { "weightGrams": 200, "heightCm": 5,  "widthCm": 8,  "depthCm": 3, "quantity": 1 }
   *   ]
   * }
   */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async quoteShipping(
    @Body() body: QuoteShippingDto,
  ): Promise<ShippingQuoteResponse> {
    return this.logisticsService.quoteShipping(body);
  }
}
