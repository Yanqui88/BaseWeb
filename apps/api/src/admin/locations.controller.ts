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
  UseGuards,
} from "@nestjs/common";
import { DbService } from "../db/db.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateLocationDto, UpdateLocationDto } from "./dto/admin.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminLocationsController {

  constructor(private db: DbService) {}

  @Get(":tenantSlug/locations")
  async list(@Param("tenantSlug") _tenantSlug: string) {
    const result = await this.db.query(
      `SELECT id, name, city, address,
              is_active AS "isActive",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM locations
       ORDER BY is_active DESC, name ASC`,
    );
    return { items: result.rows };
  }

  @Post(":tenantSlug/locations")
  async create(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() dto: CreateLocationDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");

    const result = await this.db.query(
      `INSERT INTO locations (id, tenant_id, name, city, address, is_active)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
       RETURNING id, name, city, address,
                 is_active AS "isActive",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [tenantId, dto.name, dto.city ?? null, dto.address ?? null, dto.isActive ?? true],
    );
    return result.rows[0];
  }

  @Put(":tenantSlug/locations/:locationId")
  async update(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("locationId") locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    // Verificar existencia (RLS filtra por tenant automáticamente)
    const exists = await this.db.query(
      `SELECT id FROM locations WHERE id = $1 LIMIT 1`,
      [locationId],
    );
    if (exists.rows.length === 0) throw new NotFoundException("Location not found");

    // Construir cláusulas SET dinámicamente
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); values.push(dto.name); }
    if (dto.city !== undefined) { sets.push(`city = $${idx++}`); values.push(dto.city); }
    if (dto.address !== undefined) { sets.push(`address = $${idx++}`); values.push(dto.address); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(dto.isActive); }

    // Siempre actualizar updated_at
    sets.push(`updated_at = NOW()`);
    values.push(locationId);

    const result = await this.db.query(
      `UPDATE locations SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, city, address,
                 is_active AS "isActive",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      values,
    );
    return result.rows[0];
  }

  @Delete(":tenantSlug/locations/:locationId")
  async remove(
    @Param("tenantSlug") _tenantSlug: string,
    @Param("locationId") locationId: string,
  ) {
    // Verificar existencia
    const exists = await this.db.query(
      `SELECT id FROM locations WHERE id = $1 LIMIT 1`,
      [locationId],
    );
    if (exists.rows.length === 0) throw new NotFoundException("Location not found");

    // No permitir borrar la última sucursal
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM locations`,
    );
    if (countResult.rows[0].count <= 1) {
      throw new BadRequestException("You must keep at least one location");
    }

    await this.db.query(`DELETE FROM locations WHERE id = $1`, [locationId]);
    return { ok: true };
  }
}