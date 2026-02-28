import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PrismaService } from "../prisma/prisma.service";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { readdir } from "fs/promises";

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

    // MVP: 1 banner principal
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

  @Post(":tenantSlug/uploads")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads",
        filename: (_req, file, cb) => {
          const safeExt = (extname(file.originalname) || "").toLowerCase();
          const name = `upload-${Date.now()}-${Math.round(
            Math.random() * 1e9
          )}${safeExt || ".bin"}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        // MVP: cualquier image/*
        if (!file.mimetype.startsWith("image/")) {
          return cb(new Error("Only image uploads are allowed"), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadImage(
    @Param("tenantSlug") _tenantSlug: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return { url: `/uploads/${file.filename}` };
  }


  @Get(":tenantSlug/uploads")
  async listUploads(@Param("tenantSlug") _tenantSlug: string) {
    const dir = join(process.cwd(), "uploads");
    const files = await readdir(dir);

    const images = files
      .filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f))
      .sort()
      .reverse(); // los más nuevos primero (aprox por timestamp en filename)

    return images.map((name) => ({
      name,
      url: `/uploads/${name}`,
    }));
  }
}