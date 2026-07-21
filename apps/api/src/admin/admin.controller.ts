import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { FileInterceptor } from "@nestjs/platform-express";
import { DbService } from "../db/db.service";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { readdir } from "fs/promises";
import { tenantConfigKey } from "../cache/cache-keys";
import { CacheRevalidationService } from "../cache/cache-revalidation.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UpsertBannerDto, UpdateTenantSeoDto } from "./dto/admin.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {

  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly revalidationService: CacheRevalidationService,
  ) {}

  @Get(":tenantSlug/home/banner")
  async getBanner(@Param("tenantSlug") _tenantSlug: string) {
    // RLS inyectará automáticamente el filtro por tenant_id
    const query = `
      SELECT 
        id,
        tenant_id AS "tenantId",
        desktop_image_url AS "desktopImageUrl",
        mobile_image_url AS "mobileImageUrl",
        href,
        alt,
        badge,
        title,
        subtitle,
        button_text AS "buttonText",
        is_active AS "isActive",
        sort_order AS "sortOrder",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM home_banners
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query);
    return result.rows[0] || null;
  }

  @Put(":tenantSlug/home/banner")
  async upsertBanner(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() dto: UpsertBannerDto
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new BadRequestException("No tenant context");
    }

    // Ejecutamos en una transacción para que la limpieza e inserción ocurran atómicamente
    return this.db.transaction(async (client) => {
      // Eliminar banners existentes del tenant (RLS restringe a este tenant)
      await client.query("DELETE FROM home_banners");

      // Insertar el nuevo banner
      const query = `
        INSERT INTO home_banners (
          id,
          tenant_id,
          desktop_image_url,
          mobile_image_url,
          href,
          alt,
          badge,
          title,
          subtitle,
          button_text,
          is_active,
          sort_order
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING 
          id,
          tenant_id AS "tenantId",
          desktop_image_url AS "desktopImageUrl",
          mobile_image_url AS "mobileImageUrl",
          href,
          alt,
          badge,
          title,
          subtitle,
          button_text AS "buttonText",
          is_active AS "isActive",
          sort_order AS "sortOrder"
      `;

      const result = await client.query(query, [
        tenantId,
        dto.desktopImageUrl,
        dto.mobileImageUrl,
        dto.href ?? null,
        dto.alt ?? null,
        dto.badge ?? null,
        dto.title ?? null,
        dto.subtitle ?? null,
        dto.buttonText ?? null,
        dto.isActive ?? true,
        0,
      ]);

      const row = result.rows[0];

      // Invalida la caché de configuración visual del tenant
      await this.cacheManager.del(tenantConfigKey(tenantId));
      await this.revalidationService.revalidate(tenantId, ['banner', 'config']);

      return row;
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
      .reverse();

    return images.map((name) => ({
      name,
      url: `/uploads/${name}`,
    }));
  }

  @Put(":tenantSlug/tenant/seo")
  async updateTenantSeo(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() dto: UpdateTenantSeoDto,
  ) {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new BadRequestException("No tenant context");
    }

    const query = `
      UPDATE tenants
      SET 
        seo_title = $1,
        seo_description = $2,
        seo_keywords = $3,
        seo_og_image = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING 
        id,
        name,
        domain,
        seo_title AS "seoTitle",
        seo_description AS "seoDescription",
        seo_keywords AS "seoKeywords",
        seo_og_image AS "seoOgImage"
    `;

    const result = await this.db.query(query, [
      dto.seoTitle ?? null,
      dto.seoDescription ?? null,
      dto.seoKeywords ?? null,
      dto.seoOgImage ?? null,
      tenantId,
    ]);

    // Invalida la caché de configuración visual del tenant
    await this.cacheManager.del(tenantConfigKey(tenantId));
    await this.revalidationService.revalidate(tenantId, ['config']);

    return result.rows[0];
  }
}