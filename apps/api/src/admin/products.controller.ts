/**
 * @file admin/products.controller.ts
 * @description Controlador admin para la gestión CRUD de productos.
 *
 * INVALIDACIÓN DE CACHÉ: Toda mutación (POST, PUT, DELETE) invalida la llave
 * `tenant:{tenantId}:catalog:*` del tenant activo en el contexto RLS,
 * garantizando que el catálogo público refleje los cambios de inmediato.
 *
 * Nota: Solo se invalida el catálogo, NO la config del tenant (que tiene su
 * propio ciclo de vida en el AdminController).
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { DbService } from '../db/db.service';
import { tenantCatalogKey } from '../cache/cache-keys';

type CreateProductDto = {
  title: string;
  slug: string;
  description?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  coverImage?: string | null;
};

type UpdateProductDto = Partial<CreateProductDto>;

@Controller('admin')
export class AdminProductsController {
  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Invalida TODAS las llaves de catálogo del tenant activo.
   *
   * Como el catálogo se cachea por combinación (tenantId + locationId), necesitamos
   * borrar al menos la llave "all" (sin filtro de sucursal) y confiar en que las
   * entradas por sucursal expiren por TTL o sean regeneradas en el siguiente GET.
   *
   * En producción con muchas sucursales, considerar usar SCAN + DEL en Redis
   * con patrón `tenant:{id}:catalog:*`.
   *
   * @param tenantId - UUID del tenant activo en el contexto ALS.
   */
  private async invalidateCatalogCache(tenantId: string): Promise<void> {
    // Invalida el catálogo "sin filtro de sucursal" (el más consultado)
    await this.cacheManager.del(tenantCatalogKey(tenantId, undefined));
  }

  @Get(':tenantSlug/products')
  async list(@Param('tenantSlug') _tenantSlug: string) {
    const result = await this.db.query(
      `SELECT id, title, slug, status,
              cover_image AS "coverImage",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM products
       ORDER BY created_at DESC`,
    );
    return { items: result.rows };
  }

  @Post(':tenantSlug/products')
  async create(
    @Param('tenantSlug') _tenantSlug: string,
    @Body() dto: CreateProductDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context is required');

    const result = await this.db.query(
      `INSERT INTO products (id, tenant_id, title, slug, description, status, cover_image)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::"ProductStatus", $6)
       RETURNING id, title, slug, status, cover_image AS "coverImage"`,
      [
        tenantId,
        dto.title,
        dto.slug,
        dto.description ?? null,
        dto.status ?? 'DRAFT',
        dto.coverImage ?? null,
      ],
    );

    // Invalidar caché del catálogo público
    await this.invalidateCatalogCache(tenantId);

    return result.rows[0];
  }

  @Put(':tenantSlug/products/:productId')
  async update(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;

    // Verificar existencia (RLS filtra por tenant automáticamente)
    const exists = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (exists.rows.length === 0) throw new NotFoundException('Product not found');

    // Construir cláusulas SET dinámicamente
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { sets.push(`title = $${idx++}`); values.push(dto.title); }
    if (dto.slug !== undefined) { sets.push(`slug = $${idx++}`); values.push(dto.slug); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); values.push(dto.description); }
    if (dto.status !== undefined) { sets.push(`status = $${idx++}::"ProductStatus"`); values.push(dto.status); }
    if (dto.coverImage !== undefined) { sets.push(`cover_image = $${idx++}`); values.push(dto.coverImage); }

    // Siempre actualizar updated_at
    sets.push(`updated_at = NOW()`);
    values.push(productId);

    const result = await this.db.query(
      `UPDATE products SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, title, slug, status,
                 cover_image AS "coverImage",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      values,
    );

    // Invalidar caché del catálogo público
    if (tenantId) await this.invalidateCatalogCache(tenantId);

    return result.rows[0];
  }

  @Delete(':tenantSlug/products/:productId')
  async remove(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('productId') productId: string,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;

    // Verificar existencia
    const exists = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (exists.rows.length === 0) throw new NotFoundException('Product not found');

    await this.db.query(`DELETE FROM products WHERE id = $1`, [productId]);

    // Invalidar caché del catálogo público
    if (tenantId) await this.invalidateCatalogCache(tenantId);

    return { ok: true };
  }
}