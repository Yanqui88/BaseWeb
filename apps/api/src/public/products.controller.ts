/**
 * @file products.controller.ts
 * @description Controlador público para el listado de productos de un tenant,
 * filtrado opcionalmente por sucursal.
 *
 * CACHÉ: Los resultados de cada combinación (tenant + locationId) se guardan en
 * Redis bajo la llave `tenant:{tenantId}:catalog:{locationId|"all"}` con un TTL
 * de 2 minutos. La invalidación ocurre desde los endpoints admin que crean,
 * editan o eliminan productos/variantes/inventario.
 */

import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { DbService } from '../db/db.service';
import {
  tenantCatalogKey,
  CACHE_TTL_CATALOG_MS,
} from '../cache/cache-keys';

/** Forma del ítem serializado en el listado de catálogo. */
interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  minPrice: number | null;
}

/** Respuesta envuelta del listado de catálogo. */
interface CatalogResponse {
  items: CatalogItem[];
}

@Controller('public')
export class PublicProductsController {
  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Lista los productos activos de un tenant filtrados opcionalmente por sucursal.
   *
   * Flujo con caché:
   * 1. Intenta leer la llave `tenant:{tenantId}:catalog:{locationId|all}` desde Redis.
   * 2. Si hay HIT → devuelve el valor cacheado (sin consultar Postgres).
   * 3. Si hay MISS → consulta Postgres, guarda el resultado en Redis y devuelve.
   *
   * El RLS de Postgres filtra automáticamente por tenant_id gracias al contexto
   * establecido por el TenantInterceptor antes de que este handler se ejecute.
   *
   * @param _tenantSlug - Slug del tenant en la URL (no se usa directamente; el RLS actúa por ALS).
   * @param locationId  - UUID de la sucursal para filtrar stock. Opcional.
   * @param limitRaw    - Límite de resultados (1–100, default 24). Opcional.
   */
  @Get(':tenantSlug/products')
  async listProducts(
    @Param('tenantSlug') _tenantSlug: string,
    @Query('locationId') locationId?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<CatalogResponse> {
    const limit = Math.min(Math.max(Number(limitRaw ?? '24'), 1), 100);

    // Leemos el tenantId del ALS para la llave de caché.
    const tenantId = this.db.als.getStore()?.tenantId;

    if (tenantId) {
      const cacheKey = tenantCatalogKey(tenantId, locationId);

      // 1. Intento de HIT en caché
      const cached = await this.cacheManager.get<CatalogResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. MISS → consulta SQL (RLS inyecta el filtro tenant_id automáticamente)
    const query = `
      SELECT 
        p.id,
        p.title,
        p.slug,
        p.cover_image AS "coverImage",
        MIN(v.price) AS "minPrice"
      FROM products p
      INNER JOIN variants v ON v.product_id = p.id
      INNER JOIN inventory i ON i.product_variant_id = v.id
      WHERE p.status = 'ACTIVE'
        AND ($1::uuid IS NULL OR i.location_id = $1::uuid)
        AND i.quantity > 0
      GROUP BY p.id, p.title, p.slug, p.cover_image, p.created_at
      ORDER BY p.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await this.db.query(query, [locationId || null, limit]);

      const items: CatalogItem[] = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        coverImage: row.coverImage,
        minPrice: row.minPrice !== null ? Number(row.minPrice) : null,
      }));

      const response: CatalogResponse = { items };

      // 3. Guardar en caché si tenemos contexto de tenant
      if (tenantId) {
        await this.cacheManager.set(
          tenantCatalogKey(tenantId, locationId),
          response,
          CACHE_TTL_CATALOG_MS,
        );
      }

      return response;
    } catch (e) {
      console.error('ERROR IN GET PRODUCTS:', e);
      throw e;
    }
  }
}