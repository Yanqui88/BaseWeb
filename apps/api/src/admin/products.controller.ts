import {
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
  constructor(private prisma: PrismaService) {}

  private async getTenantIdOr404(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant.id;
  }

  @Get(":tenantSlug/products")
  async list(@Param("tenantSlug") tenantSlug: string) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const items = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        coverImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  }

  @Post(":tenantSlug/products")
  async create(
    @Param("tenantSlug") tenantSlug: string,
    @Body() dto: CreateProductDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    return this.prisma.product.create({
      data: {
        tenantId,
        title: dto.title,
        slug: dto.slug,
        description: dto.description ?? null,
        status: dto.status ?? "DRAFT",
        coverImage: dto.coverImage ?? null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        coverImage: true,
      },
    });
  }

  @Put(":tenantSlug/products/:productId")
  async update(
    @Param("tenantSlug") tenantSlug: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const exists = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Product not found");

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.coverImage !== undefined ? { coverImage: dto.coverImage } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        coverImage: true,
      },
    });
  }

  @Delete(":tenantSlug/products/:productId")
  async remove(
    @Param("tenantSlug") tenantSlug: string,
    @Param("productId") productId: string,
  ) {
    const tenantId = await this.getTenantIdOr404(tenantSlug);

    const exists = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Product not found");

    await this.prisma.product.delete({ where: { id: productId } });
    return { ok: true };
  }
}