import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type UpsertBannerDto = {
  desktopImageUrl: string;
  mobileImageUrl: string;
  href?: string | null;
  alt?: string | null;
  badge?: string | null;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  isActive?: boolean;
};

@Controller("admin")
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get(":tenantSlug/home/banner")
  async getBanner(@Param("tenantSlug") tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return null;

    return this.prisma.homeBanner.findFirst({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  @Put(":tenantSlug/home/banner")
  async upsertBanner(
    @Param("tenantSlug") tenantSlug: string,
    @Body() dto: UpsertBannerDto
  ) {
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: tenantSlug },
      update: {},
      create: { slug: tenantSlug, name: `${tenantSlug} Store` },
      select: { id: true },
    });

    await this.prisma.homeBanner.deleteMany({ where: { tenantId: tenant.id } });

    return this.prisma.homeBanner.create({
      data: {
        tenantId: tenant.id,
        desktopImageUrl: dto.desktopImageUrl,
        mobileImageUrl: dto.mobileImageUrl,
        href: dto.href ?? null,
        alt: dto.alt ?? null,
        badge: dto.badge ?? null,
        title: dto.title ?? null,
        subtitle: dto.subtitle ?? null,
        buttonText: dto.buttonText ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: 0,
      },
    });
  }
}