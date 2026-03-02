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
import { PrismaService } from "../prisma/prisma.service";

type CreateLocationDto = {
  name: string;
  city?: string | null;
  address?: string | null;
  isActive?: boolean;
};

type UpdateLocationDto = Partial<CreateLocationDto>;

@Controller("admin")
export class AdminLocationsController {
  constructor(private prisma: PrismaService) {}

  private async getTenantIdOr404(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant.id;
  }

  @Get(":tenantSlug/locations")
  async list(@Param("tenantSlug") tenantSlug: string) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);
    const items = await this.prisma.location.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return { items };
  }

  @Post(":tenantSlug/locations")
  async create(
    @Param("tenantSlug") tenantSlug: string,
    @Body() dto: CreateLocationDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    return this.prisma.location.create({
      data: {
        tenantId,
        name: dto.name,
        city: dto.city ?? null,
        address: dto.address ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Put(":tenantSlug/locations/:locationId")
  async update(
    @Param("tenantSlug") tenantSlug: string,
    @Param("locationId") locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const exists = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Location not found");

    return this.prisma.location.update({
      where: { id: locationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete(":tenantSlug/locations/:locationId")
  async remove(
    @Param("tenantSlug") tenantSlug: string,
    @Param("locationId") locationId: string,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const exists = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Location not found");

    // N>0: no borrar el último depósito
    const count = await this.prisma.location.count({ where: { tenantId } });
    if (count <= 1) {
      throw new BadRequestException("You must keep at least one location");
    }

    await this.prisma.location.delete({ where: { id: locationId } });
    return { ok: true };
  }
}