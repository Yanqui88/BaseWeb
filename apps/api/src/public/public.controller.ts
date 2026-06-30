import { Controller, Get, Param } from "@nestjs/common";
import { DbService } from "../db/db.service";

@Controller("public")
export class PublicController {
  constructor(private db: DbService) {}

  @Get(":tenantSlug/home/banner")
  async getHomeBanner(@Param("tenantSlug") _tenantSlug: string) {
    const now = new Date();
    
    // Consulta SQL Puro. 
    // RLS inyectará automáticamente: AND tenant_id = app.current_tenant_id
    const query = `
      SELECT 
        desktop_image_url AS "desktopImageUrl",
        mobile_image_url AS "mobileImageUrl",
        href,
        alt,
        badge,
        title,
        subtitle,
        button_text AS "buttonText"
      FROM home_banners
      WHERE is_active = true
        AND (starts_at IS NULL OR starts_at <= $1)
        AND (ends_at IS NULL OR ends_at >= $1)
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [now]);
    return result.rows[0] || null; // null está OK si no hay banners activos
  }
}