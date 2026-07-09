/**
 * @file orders.controller.ts
 * @description Controlador REST para el módulo de órdenes.
 *
 * Expone los endpoints de gestión de órdenes del tenant activo.
 * El `PublicTenantInterceptor` a nivel de clase garantiza que el contexto
 * RLS esté activo para todas las rutas.
 *
 * Rutas:
 *   POST   /orders          → Crear una nueva orden y obtener initPoint de MP
 *   GET    /orders          → Listar órdenes del tenant (usado por apps/admin)
 *   GET    /orders/:id      → Ver detalle de una orden con sus ítems
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DbService } from '../db/db.service.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@UseInterceptors(PublicTenantInterceptor)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly db: DbService,
  ) {}

  /**
   * Crea una nueva orden de forma atómica y genera la preferencia de pago en MP.
   * El `tenant_id` se extrae del ALS (inyectado por el PublicTenantInterceptor).
   *
   * POST /orders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('x-tenant-domain') tenantDomain: string,
  ) {
    const context = this.db.als.getStore();
    if (!context?.tenantId) {
      this.logger.error('createOrder llamado sin contexto de tenant en ALS');
      throw new Error(
        'Contexto de tenant no encontrado. Asegúrate de que el PublicTenantInterceptor esté activo.',
      );
    }

    const order = await this.ordersService.createOrder(
      context.tenantId,
      dto,
      tenantDomain ?? 'localhost',
    );
    return { success: true, data: order };
  }

  /**
   * Lista las órdenes del tenant activo, paginadas.
   * RLS en Postgres garantiza el aislamiento; no se necesita filtro WHERE.
   *
   * GET /orders?page=1&limit=20
   */
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const orders = await this.ordersService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { success: true, data: orders };
  }

  /**
   * Obtiene el detalle completo de una orden con sus ítems.
   * RLS garantiza que solo se puede ver si pertenece al tenant activo.
   *
   * GET /orders/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.findOneWithItems(id);
    return { success: true, data: order };
  }
}
