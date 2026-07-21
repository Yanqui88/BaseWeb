/**
 * @file saas.controller.ts
 * @description Controlador público para el onboarding self-service de nuevos tenants.
 *
 * Hito 11 – Onboarding Self-Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Expone endpoints públicos (sin autenticación) para:
 *
 *   GET  /saas/check-domain/:domain  → Verifica disponibilidad de un dominio.
 *   POST /saas/register              → Registra un nuevo Tenant + Admin User.
 *
 * Ambos endpoints están fuera del contexto del TenantInterceptor (no dependen
 * del header `host` para identificar un tenant existente).
 *
 * Se aplica un rate limiting más estricto vía @Throttle para proteger el
 * endpoint de registro contra abusos (max 5 requests / 60 segundos).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SaasService, DomainCheckResult, RegisterResult } from './saas.service.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';

@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // GET /saas/check-domain/:domain
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si un dominio propuesto está disponible para ser usado
   * como dominio de una nueva tienda.
   *
   * Útil para validación en tiempo real durante el formulario de onboarding
   * (ej: mostrar ✅ o ❌ mientras el usuario escribe).
   *
   * @param domain - Dominio o subdominio a verificar (ej: "mi-tienda.com").
   * @returns `{ available: boolean, domain: string }`
   *
   * @example
   * GET /saas/check-domain/mi-tienda-genial.com
   * → 200 { available: true, domain: "mi-tienda-genial.com" }
   *
   * GET /saas/check-domain/tienda-existente.com
   * → 200 { available: false, domain: "tienda-existente.com" }
   */
  @Get('check-domain/:domain')
  async checkDomain(
    @Param('domain') domain: string,
  ): Promise<DomainCheckResult> {
    return this.saasService.checkDomain(domain);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /saas/register
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo Tenant (tienda) de forma self-service.
   *
   * Ejecuta una transacción SQL atómica que:
   * 1. Valida la unicidad de dominio y email.
   * 2. Crea el Tenant con configuraciones por defecto y trial de 30 días.
   * 3. Crea el registro de facturación (status: 'trial').
   * 4. Crea el Usuario Administrador con contraseña hasheada (bcrypt).
   *
   * Rate limiting: máximo 5 requests por minuto (protección anti-spam).
   *
   * @param dto - Body con `storeName`, `domain`, `email`, `password`.
   * @returns `{ message: string, tenantId: string }` con HTTP 201.
   * @throws 409 ConflictException si el dominio o email ya existen.
   * @throws 400 BadRequestException si el DTO falla la validación.
   * @throws 500 InternalServerErrorException si la transacción falla.
   *
   * @example
   * POST /saas/register
   * Body: {
   *   "storeName": "Mi Tienda Genial",
   *   "domain": "mi-tienda-genial.com",
   *   "email": "admin@mi-tienda.com",
   *   "password": "secreto123"
   * }
   * → 201 { message: "¡Tienda creada!", tenantId: "uuid-del-tenant" }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 3, ttl: 60000 }, medium: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() dto: RegisterTenantDto): Promise<RegisterResult> {
    return this.saasService.register(dto);
  }
}
