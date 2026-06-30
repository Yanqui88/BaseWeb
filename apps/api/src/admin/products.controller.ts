import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { DbService } from "../db/db.service";

type CreateProductDto = {
  title: string;
  slug: string;
  description?: string | null;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  coverImage?: string | null;
};

type UpdateProductDto = Partial<CreateProductDto>;

@Controller("admin")
export class AdminProductsController {
  constructor(private db: DbService) {}

  @Get(":tenantSlug/products")
  async list(@Param("tenantSlug") _tenantSlug: string) {
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

  @Post(":tenantSlug/products")
  async create(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() dto: CreateProductDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");

    const result = await this.db.query(
      `INSERT INTO products (id, tenant_id, title, slug, description, status, cover_image)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::"ProductStatus", $6)
       RETURNING id, title, slug, status, cover_image AS "coverImage"`,
      [
        tenantId,
        dto.title,
        dto.slug,
        dto.description ?? null,
        dto.status ?? "DRAFT",
        dto.coverImage ?? null,
      ],
    );
    return result.rows[0];
  }

  @Put(":tenantSlug/products/:productId")
  async update(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    // Verificar existencia (RLS filtra por tenant automáticamente)
    const exists = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (exists.rows.length === 0) throw new NotFoundException("Product not found");

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
      `UPDATE products SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, title, slug, status,
                 cover_image AS "coverImage",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      values,
    );
    return result.rows[0];
  }

  @Delete(":tenantSlug/products/:productId")
  async remove(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("productId") productId: string,
  ) {
    // Verificar existencia
    const exists = await this.db.query(
      `SELECT id FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (exists.rows.length === 0) throw new NotFoundException("Product not found");

    await this.db.query(`DELETE FROM products WHERE id = $1`, [productId]);
    return { ok: true };
  }
}