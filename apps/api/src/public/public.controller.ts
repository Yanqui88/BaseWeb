import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("public")
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Get(":tenantSlug/home/banner")
  async getHomeBanner(@Param("tenantSlug") tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) throw new NotFoundException("Tenant not found");

    const now = new Date();

    const banner = await this.prisma.homeBanner.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        desktopImageUrl: true,
        mobileImageUrl: true,
        href: true,
        alt: true,
        badge: true,
        title: true,
        subtitle: true,
        buttonText: true,
      },
    });

    return banner; // null está OK para MVP
  }
}