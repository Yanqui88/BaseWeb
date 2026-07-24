import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { DbService } from "../db/db.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SetInventoryDto } from "./dto/admin.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminInventoryController {

  constructor(private db: DbService) {}

  @Get(":tenantSlug/variants/:variantId/inventory")
  async list(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("variantId") variantId: string,
  ) {
    // Verificar que la variante existe (RLS filtra por tenant)
    const variant = await this.db.query(
      `SELECT id FROM variants WHERE id = $1 LIMIT 1`,
      [variantId],
    );
    if (variant.rows.length === 0) throw new NotFoundException("Variant not found");

    // Traer inventarios con nombre de sucursal
    const result = await this.db.query(
      `SELECT i.id,
              i.product_variant_id AS "variantId",
              i.location_id AS "locationId",
              i.quantity,
              i.updated_at AS "updatedAt",
              l.name AS "locationName"
       FROM inventory i
       JOIN locations l ON l.id = i.location_id
       WHERE i.product_variant_id = $1
       ORDER BY l.name ASC`,
      [variantId],
    );
    return { items: result.rows };
  }

  @Put(":tenantSlug/variants/:variantId/inventory/:locationId")
  async set(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("variantId") variantId: string,
    @Param("locationId") locationId: string,
    @Body() dto: SetInventoryDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");

    // Verificar que la variante existe
    const variant = await this.db.query(
      `SELECT id FROM variants WHERE id = $1 LIMIT 1`,
      [variantId],
    );
    if (variant.rows.length === 0) throw new NotFoundException("Variant not found");

    // Verificar que la sucursal existe
    const location = await this.db.query(
      `SELECT id FROM locations WHERE id = $1 LIMIT 1`,
      [locationId],
    );
    if (location.rows.length === 0) throw new NotFoundException("Location not found");

    // UPSERT: insertar o actualizar el inventario
    const result = await this.db.query(
      `INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (product_variant_id, location_id) DO UPDATE
         SET quantity = $4, updated_at = NOW()
       RETURNING id,
                 product_variant_id AS "variantId",
                 location_id AS "locationId",
                 quantity,
                 updated_at AS "updatedAt"`,
      [tenantId, variantId, locationId, dto.quantity],
    );
    return result.rows[0];
  }
}