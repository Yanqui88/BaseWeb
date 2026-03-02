import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type SetInventoryDto = { quantity: number };

@Controller("admin")
export class AdminInventoryController {
  constructor(private prisma: PrismaService) {}

  private async getTenantIdOr404(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant.id;
  }

  @Get(":tenantSlug/variants/:variantId/inventory")
  async list(
    @Param("tenantSlug") tenantSlug: string,
    @Param("variantId") variantId: string,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, tenantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const items = await this.prisma.inventory.findMany({
      where: { tenantId, variantId },
      include: { location: true },
      orderBy: [{ location: { name: "asc" } }],
    });

    return { items };
  }

  @Put(":tenantSlug/variants/:variantId/inventory/:locationId")
  async set(
    @Param("tenantSlug") tenantSlug: string,
    @Param("variantId") variantId: string,
    @Param("locationId") locationId: string,
    @Body() dto: SetInventoryDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, tenantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException("Location not found");

    return this.prisma.inventory.upsert({
      where: { variantId_locationId: { variantId, locationId } },
      update: { quantity: dto.quantity },
      create: { tenantId, variantId, locationId, quantity: dto.quantity },
    });
  }
}