import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("public")
export class PublicProductDetailController {
  constructor(private prisma: PrismaService) {}

  @Get(":tenantSlug/products/:slug")
  async getBySlug(
    @Param("tenantSlug") tenantSlug: string,
    @Param("slug") slug: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const product = await this.prisma.product.findFirst({
      where: { tenantId: tenant.id, slug, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImage: true,
        images: true,
        variants: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sku: true,
            title: true,
            price: true,
            compareAt: true,
            color: true,
            size: true,
            inventories: { select: { quantity: true } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException("Product not found");

    const variants = product.variants.map((v) => {
      const stockTotal = v.inventories.reduce((a, i) => a + i.quantity, 0);
      return {
        id: v.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        compareAt: v.compareAt,
        color: v.color,
        size: v.size,
        stockTotal,
      };
    });

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