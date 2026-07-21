/**
 * @file saas.service.ts
 * @description Servicio de onboarding self-service para nuevos tenants.
 *
 * Hito 11 – Onboarding Self-Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Implementa la lógica de negocio para el registro público de nuevos tenants:
 *
 * 1. `checkDomain(domain)` → verifica si el dominio ya está en uso (consulta
 *    directa al pool sin ALS/RLS, ya que la tabla `tenants` no tiene RLS).
 *
 * 2. `register(dto)` → transacción atómica que:
 *    - Valida unicidad de dominio y email.
 *    - Inserta el Tenant con `trial_ends_at` a +30 días.
 *    - Inserta el registro de billing inicial (status: 'trial').
 *    - Hashea la password con bcrypt.
 *    - Inserta el Usuario Administrador vinculado al tenant.
 *
 * ⚠️  Esta transacción se ejecuta con permisos del pool global (sin SET LOCAL
 * RLS) porque el tenant aún no existe en el contexto al momento de la
 * creación. Se usa `queryRaw` y un cliente directo del pool interno.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { DbService } from '../db/db.service.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';

/** Número de rondas de bcrypt para el hash de la contraseña. */
const BCRYPT_ROUNDS = 12;

/** Resultado del endpoint de verificación de dominio. */
export interface DomainCheckResult {
  available: boolean;
  domain: string;
}

/** Resultado del endpoint de registro. */
export interface RegisterResult {
  message: string;
  tenantId: string;
}

@Injectable()
export class SaasService {
  private readonly logger = new Logger(SaasService.name);

  /**
   * Referencia al pool interno de `pg` del DbService.
   * Se accede vía propiedad pública expuesta para operaciones de sistema
   * que no deben activar el ALS/RLS (creación de tenant).
   */
  private get pool(): Pool {
    // DbService expone el pool mediante queryRaw; para la transacción de
    // creación necesitamos un cliente dedicado del pool. Accedemos al pool
    // interno a través de una consulta controlada.
    return (this.db as any)['pool'] as Pool;
  }

  constructor(private readonly db: DbService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // VERIFICACIÓN DE DISPONIBILIDAD DE DOMINIO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si un dominio o subdominio ya está registrado en la tabla
   * `tenants`. La consulta se ejecuta directamente en el pool (sin ALS/RLS)
   * porque `tenants` es una tabla de sistema global.
   *
   * @param domain - Dominio o subdominio a verificar.
   * @returns Objeto con `available: true` si el dominio está libre.
   */
  async checkDomain(domain: string): Promise<DomainCheckResult> {
    const normalizedDomain = domain.trim().toLowerCase();

    const result = await this.db.queryRaw<{ id: string }>(
      `SELECT id FROM tenants WHERE domain = $1 LIMIT 1`,
      [normalizedDomain],
    );

    const available = result.rows.length === 0;
    return { available, domain: normalizedDomain };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGISTRO DE NUEVO TENANT (TRANSACCIÓN ATÓMICA)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo Tenant (tienda) de forma atómica mediante una
   * transacción SQL `BEGIN` / `COMMIT` / `ROLLBACK`.
   *
   * Pasos internos:
   * 1. Verifica que el dominio no esté tomado (ConflictException si existe).
   * 2. Verifica que el email no esté tomado globalmente (ConflictException si existe).
   * 3. Genera un `slug` único basado en el `storeName`.
   * 4. Inserta el Tenant con configuraciones por defecto y `trial_ends_at` a +30 días.
   * 5. Inserta el registro de billing inicial (`status: 'trial'`).
   * 6. Hashea la password con bcrypt (12 rondas).
   * 7. Inserta el Usuario Administrador vinculado al `tenant_id`.
   *
   * ⚠️  La transacción se ejecuta SIN `SET LOCAL` de RLS porque el tenant
   * no existe aún y la tabla `tenants` no tiene RLS habilitado. Se usa un
   * cliente directo del pool.
   *
   * @param dto - Datos del nuevo tenant y su administrador.
   * @returns Mensaje de éxito y el UUID del tenant creado.
   * @throws ConflictException si el dominio o email ya existen.
   * @throws InternalServerErrorException si la transacción falla.
   */
  async register(dto: RegisterTenantDto): Promise<RegisterResult> {
    const { storeName, domain, email, password } = dto;
    const normalizedDomain = domain.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // ── Pre-validación antes de abrir la transacción ───────────────────────
    // Ambas consultas usan queryRaw (sin ALS) porque son validaciones globales.
    const [domainCheck, emailCheck] = await Promise.all([
      this.db.queryRaw<{ id: string }>(
        `SELECT id FROM tenants WHERE domain = $1 LIMIT 1`,
        [normalizedDomain],
      ),
      this.db.queryRaw<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail],
      ),
    ]);

    if (domainCheck.rows.length > 0) {
      throw new ConflictException(
        `El dominio "${normalizedDomain}" ya está en uso por otra tienda.`,
      );
    }

    if (emailCheck.rows.length > 0) {
      throw new ConflictException(
        `El email "${normalizedEmail}" ya está registrado.`,
      );
    }

    // ── Hashear contraseña antes de la transacción (operación CPU costosa) ─
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── Generar slug único a partir del storeName ──────────────────────────
    const baseSlug = this.generateSlug(storeName);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // ── Ejecutar transacción atómica en el pool global ─────────────────────
    // Se usa un cliente directo del pool para tener control total del
    // BEGIN / COMMIT / ROLLBACK sin que el DbService aplique RLS.
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // ── Paso 1: Insertar Tenant ──────────────────────────────────────────
      const tenantResult = await client.query<{ id: string }>(
        `INSERT INTO tenants (
           slug,
           name,
           domain,
           primary_color,
           secondary_color,
           logo_url,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        [
          slug,
          storeName.trim(),
          normalizedDomain,
          '#3B82F6',  // Azul por defecto (tailwind blue-500)
          '#1D4ED8',  // Azul oscuro por defecto (tailwind blue-700)
          null,       // logo_url: null hasta que el admin lo configure
        ],
      );

      const tenantId = tenantResult.rows[0].id;
      this.logger.log(`Tenant creado: id=${tenantId}, slug=${slug}`);

      // ── Paso 2: Insertar registro de billing (trial 30 días) ─────────────
      await client.query(
        `INSERT INTO tenant_billing (
           tenant_id,
           status,
           trial_ends_at,
           created_at,
           updated_at
         )
         VALUES ($1, 'trial', NOW() + INTERVAL '30 days', NOW(), NOW())`,
        [tenantId],
      );

      this.logger.log(`tenant_billing creado: tenant_id=${tenantId}, status=trial`);

      // ── Paso 3: Insertar Usuario Administrador ───────────────────────────
      await client.query(
        `INSERT INTO users (
           tenant_id,
           email,
           password_hash,
           name,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          tenantId,
          normalizedEmail,
          passwordHash,
          storeName.trim(), // nombre del admin = nombre de la tienda por defecto
        ],
      );

      this.logger.log(`Usuario admin creado: email=${normalizedEmail}, tenant_id=${tenantId}`);

      await client.query('COMMIT');

      return {
        message: `¡Tienda "${storeName.trim()}" creada exitosamente! Tu período de prueba de 30 días ha comenzado.`,
        tenantId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error en la transacción de registro de tenant:', error);

      // Propagar errores de unicidad de PG como ConflictException
      if ((error as any).code === '23505') {
        throw new ConflictException(
          'El dominio o email ya están en uso. Por favor elige valores diferentes.',
        );
      }

      throw new InternalServerErrorException(
        'Error al crear la tienda. Por favor intenta de nuevo.',
      );
    } finally {
      client.release();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Convierte un nombre de tienda en un slug URL-amigable.
   * Ejemplo: "Mi Tienda Genial!" → "mi-tienda-genial"
   *
   * @param name - Nombre de la tienda.
   * @returns Slug normalizado.
   */
  private generateSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos (acentos)
      .replace(/[^a-z0-9\s-]/g, '')    // Solo letras, números, espacios y guiones
      .replace(/\s+/g, '-')            // Espacios → guiones
      .replace(/-+/g, '-')             // Múltiples guiones → uno solo
      .replace(/^-+|-+$/g, '');        // Eliminar guiones al inicio/fin
  }

  /**
   * Asegura que el slug generado sea único en la tabla `tenants`.
   * Si el slug base ya existe, agrega un sufijo numérico incremental.
   * Ejemplo: "mi-tienda" → "mi-tienda-2" → "mi-tienda-3"
   *
   * @param baseSlug - Slug base generado desde el nombre.
   * @returns Slug único garantizado.
   */
  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const result = await this.db.queryRaw<{ id: string }>(
        `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
        [slug],
      );

      if (result.rows.length === 0) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }
}
