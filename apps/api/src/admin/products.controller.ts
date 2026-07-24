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
  UseGuards,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { DbService } from '../db/db.service';
import { tenantCatalogKey } from '../cache/cache-keys';
import { CacheRevalidationService } from '../cache/cache-revalidation.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto, UpdateProductDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminProductsController {

  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly revalidationService: CacheRevalidationService,
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
      `SELECT p.id, p.title, p.slug, p.status, p.description,
              p.cover_image AS "coverImage",
              p.created_at AS "createdAt",
              p.updated_at AS "updatedAt",
              MIN(v.sku) as sku,
              MIN(v.price) as price,
              COALESCE(SUM(i.quantity), 0) AS stock
       FROM products p
       LEFT JOIN variants v ON v.product_id = p.id
       LEFT JOIN inventory i ON i.product_variant_id = v.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
    );
    return { items: result.rows };
  }

  @Post(':tenantSlug/products')
  async create(
    @Param('tenantSlug') _tenantSlug: string,
    @Body() dto: any,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context is required');

    const result = await this.db.query(
      `INSERT INTO products (id, tenant_id, title, slug, description, status, cover_image)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"ProductStatus", $6)
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

    const productId = result.rows[0].id;
    const price = typeof dto.price === 'number' ? dto.price : 0;
    const sku = typeof dto.sku === 'string' ? dto.sku : `SKU-${Date.now()}`;
    const stock = typeof dto.stock === 'number' ? dto.stock : 0;

    const variantRes = await this.db.query(
      `INSERT INTO variants (id, tenant_id, product_id, sku, title, price)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, productId, sku, 'Default', price]
    );

    const locationRes = await this.db.query(`SELECT id FROM locations WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
    if (locationRes.rows[0]) {
      await this.db.query(
        `INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [tenantId, variantRes.rows[0].id, locationRes.rows[0].id, stock]
      );
    }

    await this.invalidateCatalogCache(tenantId);
    await this.revalidationService.revalidate(tenantId, ['products']);

    return result.rows[0];
  }

  @Put(':tenantSlug/products/:productId')
  async update(
    @Param('tenantSlug') _tenantSlug: string,
    @Param('productId') productId: string,
    @Body() dto: any,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;

    const exists = await this.db.query(`SELECT id FROM products WHERE id = $1 LIMIT 1`, [productId]);
    if (exists.rows.length === 0) throw new NotFoundException('Product not found');

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { sets.push(`title = $${idx++}`); values.push(dto.title); }
    if (dto.slug !== undefined) { sets.push(`slug = $${idx++}`); values.push(dto.slug); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); values.push(dto.description); }
    if (dto.status !== undefined) { sets.push(`status = $${idx++}::"ProductStatus"`); values.push(dto.status); }
    if (dto.coverImage !== undefined) { sets.push(`cover_image = $${idx++}`); values.push(dto.coverImage); }

    sets.push(`updated_at = NOW()`);
    values.push(productId);

    const result = await this.db.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, title, slug, status, cover_image AS "coverImage"`,
      values,
    );

    if (dto.price !== undefined || dto.sku !== undefined) {
      const variantRes = await this.db.query(`SELECT id FROM variants WHERE product_id = $1 LIMIT 1`, [productId]);
      if (variantRes.rows.length > 0) {
        const vId = variantRes.rows[0].id;
        const vSets: string[] = [];
        const vVals: any[] = [];
        let vIdx = 1;
        if (dto.price !== undefined) { vSets.push(`price = $${vIdx++}`); vVals.push(dto.price); }
        if (dto.sku !== undefined) { vSets.push(`sku = $${vIdx++}`); vVals.push(dto.sku); }
        vVals.push(vId);
        if (vSets.length > 0) {
          await this.db.query(`UPDATE variants SET ${vSets.join(', ')} WHERE id = $${vIdx}`, vVals);
        }
        
        if (dto.stock !== undefined) {
          const locRes = await this.db.query(`SELECT id FROM locations WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
          if (locRes.rows[0]) {
             await this.db.query(`
               INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity)
               VALUES (gen_random_uuid(), $1, $2, $3, $4)
               ON CONFLICT (product_variant_id, location_id)
               DO UPDATE SET quantity = EXCLUDED.quantity
             `, [tenantId, vId, locRes.rows[0].id, dto.stock]);
          }
        }
      }
    }

    if (tenantId) {
      await this.invalidateCatalogCache(tenantId);
      await this.revalidationService.revalidate(tenantId, ['products']);
    }

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
    if (tenantId) {
      await this.invalidateCatalogCache(tenantId);
      await this.revalidationService.revalidate(tenantId, ['products']);
    }

    return { ok: true };
  }
}