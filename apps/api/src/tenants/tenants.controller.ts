/**
 * @file tenants.controller.ts
 * @description Controlador público de Tenants expuesto para validación interna por Caddy.
 *
 * Hito 8 – Fase 5: Cierre del anillo de seguridad Caddy ↔ NestJS
 * ─────────────────────────────────────────────────────────────────────────────
 * Expone el endpoint GET /api/tenants/verify-domain?domain=<dominio> que
 * Caddy consume mediante su módulo `ask` para decidir si debe emitir un
 * certificado TLS para un dominio dado.
 *
 * SEGURIDAD:
 *   - Protegido por `ProxyGuard` (header X-Proxy-Secret obligatorio).
 *   - Rate Limit restrictivo propio: 30 req/min (throttler "caddy-verify").
 *   - Consulta bypasa RLS usando isSuperAdmin=true (tabla tenants es global).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantsService } from './tenants.service';
import { ProxyGuard } from '../common/guards/proxy.guard';

@Controller('tenants')
@UseGuards(ProxyGuard)
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Endpoint de validación de dominio para Caddy (módulo `ask`).
   *
   * Caddy llama a este endpoint antes de solicitar/renovar un certificado TLS
   * para un dominio. Responde HTTP 200 si el dominio pertenece a un tenant
   * activo, HTTP 404 en caso contrario.
   *
   * Rate Limit especial: 30 peticiones / 60 segundos.
   * (Reemplaza los throttlers globales "short" y "medium" para esta ruta.)
   *
   * @param domain - FQDN a verificar (ej. "tienda.example.com").
   */
  @Get('verify-domain')
  @Throttle({ long: { limit: 30, ttl: 60_000 } })
  async verifyDomain(@Query('domain') domain: string): Promise<{ domain: string; tenantId: string }> {
    if (!domain) {
      throw new NotFoundException('Parámetro `domain` requerido.');
    }

    this.logger.debug(`[verify-domain] Verificando dominio: ${domain}`);

    const tenant = await this.tenantsService.findActiveByDomain(domain);

    if (!tenant) {
      this.logger.warn(`[verify-domain] Dominio no encontrado: ${domain}`);
      throw new NotFoundException(`El dominio '${domain}' no pertenece a ningún tenant activo.`);
    }

    this.logger.log(`[verify-domain] OK → ${domain} → tenant ${tenant.id}`);
    return { domain, tenantId: tenant.id };
  }
}
