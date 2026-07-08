import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { DbService } from "../db/db.service";

@Controller("public")
export class PublicProductDetailController {
  constructor(private db: DbService) {}

  @Get(":tenantSlug/products/:slug")
  async getBySlug(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("slug") slug: string,
    @Query("locationId") locationId?: string,
  ) {
    // 1. Obtener los detalles del producto activo.
    // RLS inyecta automáticamente el filtro por tenant_id.
    const productQuery = `
      SELECT 
        id,
        title,
        slug,
        description,
        cover_image AS "coverImage",
        images
      FROM products
      WHERE slug = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;

    const productResult = await this.db.query(productQuery, [slug]);
    const product = productResult.rows[0];

    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    // 2. Obtener las variantes del producto con sus opciones agregadas en JSON (EAV)
    // y el stock calculado para la sucursal seleccionada (o stock total si es null)
    const variantsQuery = `
      SELECT 
        v.id,
        v.sku,
        v.title,
        v.price,
        v.compare_at AS "compareAt",
        COALESCE(SUM(CASE WHEN $2::uuid IS NULL OR i.location_id = $2::uuid THEN i.quantity ELSE 0 END), 0)::int AS "stockTotal",
        jsonb_object_agg(LOWER(po.name), pov.value) AS "options"
      FROM variants v
      LEFT JOIN inventory i ON i.product_variant_id = v.id
      LEFT JOIN variant_option_values vov ON vov.variant_id = v.id
      LEFT JOIN product_option_values pov ON pov.id = vov.option_value_id
      LEFT JOIN product_options po ON po.id = pov.option_id
      WHERE v.product_id = $1
      GROUP BY v.id, v.created_at
      ORDER BY v.created_at ASC
    `;

    const variantsResult = await this.db.query(variantsQuery, [product.id, locationId || null]);

    const variants = variantsResult.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      title: row.title,
      price: row.price,
      compareAt: row.compareAt,
      // Mapeamos las llaves dinámicas del JSON agregadas de Postgres
      color: row.options?.color || null,
      size: row.options?.talle || row.options?.size || null,
      stockTotal: row.stockTotal,
    }));

    // Calcular el precio mínimo de las variantes que tienen stock
    const pricesInStock = variants
      .filter((v) => v.stockTotal > 0)
      .map((v) => v.price);

    const minPrice = pricesInStock.length ? Math.min(...pricesInStock) : null;

    return {
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        coverImage: product.coverImage,
        images: product.images,
        minPrice,
        variants,
      },
    };
  }
}