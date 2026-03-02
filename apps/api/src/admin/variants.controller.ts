import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type CreateVariantDto = {
  sku: string;          // obligatorio
  price: number;        // centavos

  title?: string | null;
  compareAt?: number | null;
  color?: string | null;
  size?: string | null;
};

type UpdateVariantDto = {
  sku?: string;
  price?: number;

  title?: string | null;
  compareAt?: number | null;
  color?: string | null;
  size?: string | null;
};

type UpdateStockDto = {
  quantity: number;
  location?: string | null; // opcional (por ahora es un string, luego lo migraremos a depósitos reales)
};

@Controller("admin")
export class AdminVariantsController {
  constructor(private prisma: PrismaService) {}

  private async getTenantIdOr404(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant.id;
  }

  @Get(":tenantSlug/products/:productId/variants")
  async listVariants(
    @Param("tenantSlug") tenantSlug: string,
    @Param("productId") productId: string,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    const variants = await this.prisma.variant.findMany({
      where: { productId, tenantId },
      include: { stock: true },
      orderBy: { createdAt: "asc" },
    });

    return { items: variants };
  }

  @Post(":tenantSlug/products/:productId/variants")
  async createVariant(
    @Param("tenantSlug") tenantSlug: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    return this.prisma.variant.create({
      data: {
        tenantId,
        productId,
        sku: dto.sku,
        price: dto.price,
        title: dto.title ?? null,
        compareAt: dto.compareAt ?? null,
        color: dto.color ?? null,
        size: dto.size ?? null,
        stock: {
          create: {
            tenantId,
            quantity: 0,
            location: null,
          },
        },
      },
      include: { stock: true },
    });
  }

  @Put(":tenantSlug/variants/:variantId")
  async updateVariant(
    @Param("tenantSlug") tenantSlug: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const exists = await this.prisma.variant.findFirst({
      where: { id: variantId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Variant not found");

    return this.prisma.variant.update({
      where: { id: variantId },
      data: {
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.compareAt !== undefined ? { compareAt: dto.compareAt } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.size !== undefined ? { size: dto.size } : {}),
      },
    });
  }

  @Put(":tenantSlug/variants/:variantId/stock")
  async updateStock(
    @Param("tenantSlug") tenantSlug: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateStockDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, tenantId },
      include: { stock: true },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    if (!variant.stock) {
      return this.prisma.stock.create({
        data: {
          tenantId,
          variantId,
          quantity: dto.quantity,
          location: dto.location ?? null,
        },
      });
    }

    return this.prisma.stock.update({
      where: { id: variant.stock.id },
      data: {
        quantity: dto.quantity,
        ...(dto.location !== undefined ? { location: dto.location } : {}),
      },
    });
  }
}