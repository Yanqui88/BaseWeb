import { Controller, Get, Param, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("public")
export class PublicProductsController {
  constructor(private prisma: PrismaService) {}

  @Get(":tenantSlug/products")
  async listProducts(
    @Param("tenantSlug") tenantSlug: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw ?? "24"), 1), 100);

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) return { items: [] };

    const products = await this.prisma.product.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        variants: {
          select: {
            price: true,
            inventories: { select: { quantity: true } },
          },
        },
      },
    });

    const items = products.map((p) => {
      const pricesInStock = p.variants
        .filter(
          (v) => v.inventories.reduce((a, i) => a + i.quantity, 0) > 0,
        )
        .map((v) => v.price);

      const minPrice = pricesInStock.length ? Math.min(...pricesInStock) : null;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        coverImage: p.coverImage,
        minPrice,
      };
    });

    return { items };
  }
}