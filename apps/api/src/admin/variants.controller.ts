import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { DbService } from "../db/db.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateVariantDto, UpdateVariantDto } from "./dto/admin.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminVariantsController {

  constructor(private db: DbService) {}

  @Get(":tenantSlug/products/:productId/variants")
  async listVariants(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("productId") productId: string,
  ) {
    // Verificar que el producto existe (RLS filtra por tenant)
    const product = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (product.rows.length === 0) throw new NotFoundException("Product not found");

    // Traer variantes con stock total calculado desde inventories
    const result = await this.db.query(
      `SELECT v.id, v.sku, v.title, v.price,
              v.compare_at AS "compareAt",
              v.created_at AS "createdAt",
              v.updated_at AS "updatedAt",
              COALESCE(SUM(i.quantity), 0)::int AS "stockTotal"
       FROM variants v
       LEFT JOIN inventory i ON i.product_variant_id = v.id
       WHERE v.product_id = $1
       GROUP BY v.id, v.created_at
       ORDER BY v.created_at ASC`,
      [productId],
    );
    return { items: result.rows };
  }

  @Post(":tenantSlug/products/:productId/variants")
  async createVariant(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");

    // Verificar que el producto existe
    const product = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (product.rows.length === 0) throw new NotFoundException("Product not found");

    const result = await this.db.query(
      `INSERT INTO variants (id, tenant_id, product_id, sku, title, price, compare_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id, sku, title, price,
                 compare_at AS "compareAt",
                 created_at AS "createdAt"`,
      [tenantId, productId, dto.sku, dto.title ?? null, dto.price, dto.compareAt ?? null],
    );
    return result.rows[0];
  }

  @Put(":tenantSlug/variants/:variantId")
  async updateVariant(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    // Verificar existencia (RLS filtra por tenant)
    const exists = await this.db.query(
      `SELECT id FROM variants WHERE id = $1 LIMIT 1`,
      [variantId],
    );
    if (exists.rows.length === 0) throw new NotFoundException("Variant not found");

    // Construir cláusulas SET dinámicamente
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.sku !== undefined) { sets.push(`sku = $${idx++}`); values.push(dto.sku); }
    if (dto.price !== undefined) { sets.push(`price = $${idx++}`); values.push(dto.price); }
    if (dto.title !== undefined) { sets.push(`title = $${idx++}`); values.push(dto.title); }
    if (dto.compareAt !== undefined) { sets.push(`compare_at = $${idx++}`); values.push(dto.compareAt); }

    // Siempre actualizar updated_at
    sets.push(`updated_at = NOW()`);
    values.push(variantId);

    const result = await this.db.query(
      `UPDATE variants SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, sku, title, price,
                 compare_at AS "compareAt",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      values,
    );
    return result.rows[0];
  }
}