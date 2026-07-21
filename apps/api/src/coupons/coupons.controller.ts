/**
 * @file coupons.controller.ts
 * @description Controlador REST del módulo de cupones.
 *
 * Expone dos familias de endpoints:
 *
 * ── Admin (panel de gestión, bajo /admin/:tenantSlug/coupons) ─────────────
 *   GET    /admin/:tenantSlug/coupons          → listar cupones paginados
 *   GET    /admin/:tenantSlug/coupons/:id      → detalle de un cupón
 *   POST   /admin/:tenantSlug/coupons          → crear cupón
 *   PUT    /admin/:tenantSlug/coupons/:id      → editar cupón
 *   DELETE /admin/:tenantSlug/coupons/:id      → soft-delete (is_active=false)
 *
 * ── Público (checkout del cliente, bajo /public/coupons) ──────────────────
 *   GET    /public/coupons/validate/:code      → validar código de cupón
 *
 * El contexto RLS se activa para los endpoints admin mediante el
 * `TenantInterceptor` global (registrado en `AppModule`), que lee el
 * `:tenantSlug` de la URL y establece `app.current_tenant_id` en Postgres.
 *
 * Para el endpoint público, el `PublicTenantInterceptor` (a nivel de método)
 * activa el contexto RLS a partir del header `x-tenant-domain`.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CouponsService } from './coupons.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

// ──────────────────────────────────────────────────────────────────────────────
// CONTROLADOR ADMIN
// ──────────────────────────────────────────────────────────────────────────────

@Controller('admin/:tenantSlug/coupons')
@UseGuards(JwtAuthGuard)
export class AdminCouponsController {

  private readonly logger = new Logger(AdminCouponsController.name);

  constructor(private readonly couponsService: CouponsService) {}

  /**
   * Lista cupones del tenant activo con paginación.
   * GET /admin/:tenantSlug/coupons?page=1&limit=20
   */
  @Get()
  async findAll(
    @Param('tenantSlug') _tenantSlug: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const result = await this.couponsService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { success: true, ...result };
  }

  /**
   * Devuelve el detalle de un cupón por su UUID.
   * GET /admin/:tenantSlug/coupons/:id
   */
  @Get(':id')
  async findOne(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('id') id: string,
  ) {
    const coupon = await this.couponsService.findOne(id);
    return { success: true, data: coupon };
  }

  /**
   * Crea un nuevo cupón para el tenant activo.
   * POST /admin/:tenantSlug/coupons
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('tenantSlug') _tenantSlug: string,
    @Body() dto: CreateCouponDto,
  ) {
    const coupon = await this.couponsService.create(dto);
    return { success: true, data: coupon };
  }

  /**
   * Actualiza un cupón existente (campos seleccionados).
   * PUT /admin/:tenantSlug/coupons/:id
   */
  @Put(':id')
  async update(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.couponsService.update(id, dto);
    return { success: true, data: coupon };
  }

  /**
   * Soft-delete: desactiva el cupón (is_active = false).
   * DELETE /admin/:tenantSlug/coupons/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.couponsService.deactivate(id);
    return result;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTROLADOR PÚBLICO
// ──────────────────────────────────────────────────────────────────────────────

@UseInterceptors(PublicTenantInterceptor)
@Controller('public/coupons')
export class PublicCouponsController {
  private readonly logger = new Logger(PublicCouponsController.name);

  constructor(private readonly couponsService: CouponsService) {}

  /**
   * Valida un código de cupón para el tenant resuelto desde x-tenant-domain.
   *
   * Verifica que el cupón:
   *  - Exista y esté activo.
   *  - Se encuentre dentro del rango de fechas válido.
   *  - No haya superado su límite de usos.
   *
   * GET /public/coupons/validate/:code
   * Header requerido: x-tenant-domain: <dominio-del-tenant>
   */
  @Get('validate/:code')
  async validate(@Param('code') code: string) {
    const result = await this.couponsService.validate(code);
    return { success: true, data: result };
  }
}
