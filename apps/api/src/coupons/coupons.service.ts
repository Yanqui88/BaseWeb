/**
 * @file coupons.service.ts
 * @description Servicio con la lógica de negocio del Motor de Cupones.
 *
 * Todas las consultas se ejecutan a través de `DbService.query()` o
 * `DbService.transaction()`, que inyectan automáticamente las sentencias
 * `SET LOCAL app.current_tenant_id` requeridas por las políticas RLS de
 * Postgres. No se necesitan filtros WHERE manuales por tenant_id en SELECT,
 * UPDATE ni DELETE.
 *
 * Endpoints cubiertos:
 * ─────────────────────────────────────────────────────────────────────────
 *  Admin (panel de gestión):
 *    findAll()       → GET  /admin/:tenantSlug/coupons
 *    findOne()       → GET  /admin/:tenantSlug/coupons/:id
 *    create()        → POST /admin/:tenantSlug/coupons
 *    update()        → PUT  /admin/:tenantSlug/coupons/:id
 *    deactivate()    → DELETE /admin/:tenantSlug/coupons/:id  (soft-delete)
 *
 *  Público (checkout del cliente):
 *    validate()      → GET  /public/coupons/validate/:code
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { CouponRow, ValidateCouponResult } from './coupons.types.js';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly db: DbService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODOS ADMIN
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Lista todos los cupones del tenant activo (RLS filtra automáticamente).
   * Soporta paginación básica con `page` y `limit`.
   */
  async findAll(page = 1, limit = 20): Promise<{ data: CouponRow[]; total: number }> {
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      this.db.query<CouponRow>(
        `SELECT
           id, tenant_id, code, discount_type, discount_value,
           valid_from, valid_until, usage_limit, times_used, is_active,
           created_at, updated_at
         FROM coupons
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.db.query<{ count: string }>('SELECT COUNT(*) AS count FROM coupons'),
    ]);

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  /**
   * Obtiene un cupón por su ID.
   * Lanza `NotFoundException` si no existe en el tenant activo.
   */
  async findOne(id: string): Promise<CouponRow> {
    const result = await this.db.query<CouponRow>(
      `SELECT
         id, tenant_id, code, discount_type, discount_value,
         valid_from, valid_until, usage_limit, times_used, is_active,
         created_at, updated_at
       FROM coupons
       WHERE id = $1`,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Cupón con id '${id}' no encontrado.`);
    }

    return result.rows[0];
  }

  /**
   * Crea un nuevo cupón para el tenant activo.
   * El `tenant_id` se extrae del AsyncLocalStorage (inyectado por el interceptor).
   *
   * Lanza `ConflictException` si el código ya existe para el tenant.
   * Lanza `BadRequestException` si no hay contexto de tenant en el ALS.
   */
  async create(dto: CreateCouponDto): Promise<CouponRow> {
    const context = this.db.als.getStore();
    if (!context?.tenantId) {
      throw new BadRequestException('No hay contexto de tenant activo.');
    }

    const tenantId = context.tenantId;

    try {
      const result = await this.db.query<CouponRow>(
        `INSERT INTO coupons (
           tenant_id, code, discount_type, discount_value,
           valid_from, valid_until, usage_limit, is_active
         ) VALUES (
           $1, UPPER($2), $3, $4,
           $5, $6, $7, $8
         )
         RETURNING
           id, tenant_id, code, discount_type, discount_value,
           valid_from, valid_until, usage_limit, times_used, is_active,
           created_at, updated_at`,
        [
          tenantId,
          dto.code.trim(),
          dto.discount_type,
          dto.discount_value,
          dto.valid_from ?? new Date().toISOString(),
          dto.valid_until ?? null,
          dto.usage_limit ?? null,
          dto.is_active ?? true,
        ],
      );

      return result.rows[0];
    } catch (err: any) {
      // Constraint UNIQUE (tenant_id, code)
      if (err?.code === '23505') {
        throw new ConflictException(
          `El código '${dto.code.toUpperCase()}' ya existe para este tenant.`,
        );
      }
      throw err;
    }
  }

  /**
   * Actualiza los campos indicados de un cupón existente (PATCH semántico).
   * Solo se actualizan los campos presentes en el DTO.
   */
  async update(id: string, dto: UpdateCouponDto): Promise<CouponRow> {
    // Verificamos existencia primero (también aplica RLS)
    await this.findOne(id);

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | undefined)[] = [];
    let paramIdx = 1;

    if (dto.code !== undefined) {
      setClauses.push(`code = UPPER($${paramIdx++})`);
      values.push(dto.code.trim());
    }
    if (dto.discount_type !== undefined) {
      setClauses.push(`discount_type = $${paramIdx++}`);
      values.push(dto.discount_type);
    }
    if (dto.discount_value !== undefined) {
      setClauses.push(`discount_value = $${paramIdx++}`);
      values.push(dto.discount_value);
    }
    if (dto.valid_from !== undefined) {
      setClauses.push(`valid_from = $${paramIdx++}`);
      values.push(dto.valid_from);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'valid_until')) {
      setClauses.push(`valid_until = $${paramIdx++}`);
      values.push(dto.valid_until ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'usage_limit')) {
      setClauses.push(`usage_limit = $${paramIdx++}`);
      values.push(dto.usage_limit ?? null);
    }
    if (dto.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIdx++}`);
      values.push(dto.is_active);
    }

    if (setClauses.length === 0) {
      throw new BadRequestException('No se proporcionaron campos para actualizar.');
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await this.db.query<CouponRow>(
        `UPDATE coupons
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIdx}
         RETURNING
           id, tenant_id, code, discount_type, discount_value,
           valid_from, valid_until, usage_limit, times_used, is_active,
           created_at, updated_at`,
        values,
      );

      if (!result.rows[0]) {
        throw new NotFoundException(`Cupón con id '${id}' no encontrado.`);
      }

      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(
          `El código '${dto.code?.toUpperCase()}' ya existe para este tenant.`,
        );
      }
      throw err;
    }
  }

  /**
   * Soft-delete: desactiva el cupón (is_active = false) en lugar de borrarlo.
   * Preserva el historial de uso y las referencias en órdenes pasadas.
   */
  async deactivate(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);

    await this.db.query(
      `UPDATE coupons SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODO PÚBLICO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Valida un código de cupón para el tenant activo (contexto RLS activo vía
   * `PublicTenantInterceptor`).
   *
   * Verifica:
   *  1. El cupón existe y está activo (`is_active = true`).
   *  2. La fecha actual está dentro del rango [valid_from, valid_until].
   *  3. No se superó el `usage_limit` (si aplica).
   *
   * @returns Los datos del descuento si el cupón es válido.
   * @throws NotFoundException  si el código no existe o está inactivo.
   * @throws BadRequestException si el cupón está vencido o agotado.
   */
  async validate(code: string): Promise<ValidateCouponResult> {
    const result = await this.db.query<CouponRow>(
      `SELECT
         id, tenant_id, code, discount_type, discount_value,
         valid_from, valid_until, usage_limit, times_used, is_active
       FROM coupons
       WHERE code = UPPER($1)`,
      [code.trim()],
    );

    const coupon = result.rows[0];

    if (!coupon || !coupon.is_active) {
      throw new NotFoundException(`El cupón '${code.toUpperCase()}' no es válido.`);
    }

    const now = new Date();

    if (coupon.valid_from && now < new Date(coupon.valid_from)) {
      throw new BadRequestException(
        `El cupón '${coupon.code}' aún no está vigente.`,
      );
    }

    if (coupon.valid_until && now > new Date(coupon.valid_until)) {
      throw new BadRequestException(
        `El cupón '${coupon.code}' ha expirado.`,
      );
    }

    if (
      coupon.usage_limit !== null &&
      coupon.times_used >= coupon.usage_limit
    ) {
      throw new BadRequestException(
        `El cupón '${coupon.code}' ha alcanzado su límite de usos.`,
      );
    }

    return {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: parseFloat(coupon.discount_value as unknown as string),
    };
  }
}
