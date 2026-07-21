/**
 * @file public-tenant.controller.ts
 * @description Controlador público para exponer las configuraciones visuales
 * base de un tenant, resuelto dinámicamente por dominio.
 *
 * El `PublicTenantInterceptor` se aplica a nivel de controlador, garantizando
 * que TODAS las rutas dentro de este controlador tengan el contexto RLS activo
 * antes de que el handler delegue al servicio.
 *
 * Endpoint:
 *   GET /public/tenant/config
 *   Headers requeridos: x-tenant-domain: <dominio-del-visitante>
 */

import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { PublicTenantInterceptor } from './public-tenant.interceptor.js';
import { PublicTenantService, TenantPublicConfig } from './public-tenant.service.js';

@Controller('public/tenant')
@UseInterceptors(PublicTenantInterceptor)
export class PublicTenantController {
  constructor(private readonly publicTenantService: PublicTenantService) {}

  /**
   * Devuelve las configuraciones visuales base del tenant correspondiente
   * al dominio enviado en el header `x-tenant-domain`.
   *
   * El RLS de PostgreSQL, activado por el `PublicTenantInterceptor`, garantiza
   * que la consulta SQL retorne únicamente los datos del tenant correcto.
   *
   * @returns Configuración visual del tenant (colores, logo, nombre, dominio).
   *
   * @example
   * // Request:
   * GET /public/tenant/config
   * x-tenant-domain: tienda-abc.com
   *
   * // Response 200:
   * {
   *   "id": "uuid-del-tenant",
   *   "name": "Tienda ABC",
   *   "domain": "tienda-abc.com",
   *   "primary_color": "#FF6B35",
   *   "secondary_color": "#004E89",
   *   "logo_url": "https://cdn.example.com/logo.png"
   * }
   *
   * // Response 404 (dominio inexistente):
   * { "statusCode": 404, "message": "No existe ningún tenant registrado para el dominio '...'" }
   */
  @Get('config')
  async getTenantConfig(): Promise<TenantPublicConfig | null> {
    return this.publicTenantService.getTenantPublicConfig();
  }

  @Get('sitemap')
  async getTenantSitemap(): Promise<Array<{ slug: string; updated_at: string }>> {
    return this.publicTenantService.getTenantSitemap();
  }
}
