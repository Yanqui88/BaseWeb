import { Controller, Get, Param, Query } from "@nestjs/common";
import { DbService } from "../db/db.service";

@Controller("public")
export class PublicProductsController {
  constructor(private db: DbService) {}

  @Get(":tenantSlug/products")
  async listProducts(
    @Param("tenantSlug") _tenantSlug: string,
    @Query("locationId") locationId?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw ?? "24"), 1), 100);

    // Consulta SQL Puro.
    // Buscamos productos activos, uniendo sus variantes e inventarios.
    // Si se pasa locationId, se filtra el stock de ese local; si es null, se verifica el stock global.
    // RLS inyectará automáticamente el filtro por tenant_id detrás de escena.
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

      const items = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        coverImage: row.coverImage,
        minPrice: row.minPrice !== null ? Number(row.minPrice) : null,
      }));

      return { items };
    } catch (e) {
      console.error("ERROR IN GET PRODUCTS:", e);
      throw e;
    }
  }
}