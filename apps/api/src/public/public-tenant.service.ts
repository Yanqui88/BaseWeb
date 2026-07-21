/**
 * @file public-tenant.service.ts
 * @description Servicio que encapsula la lógica de consulta de configuraciones
 * visuales públicas de un tenant, con caché Redis integrada.
 *
 * IMPORTANTE: Este servicio NO añade filtros `WHERE tenant_id = ?` manuales.
 * El aislamiento por tenant lo garantiza el RLS de PostgreSQL, activado
 * automáticamente por el `PublicTenantInterceptor` antes de que este método
 * sea invocado.
 *
 * CACHÉ: Los resultados se guardan en Redis bajo la llave
 * `tenant:{tenantId}:config` con un TTL de 5 minutos. La invalidación ocurre
 * desde los endpoints admin que modifican la configuración del tenant.
 */

import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { DbService } from '../db/db.service.js';
import {
  tenantConfigKey,
  CACHE_TTL_TENANT_CONFIG_MS,
} from '../cache/cache-keys.js';

/** Configuración visual pública de un tenant. */
export interface TenantPublicConfig {
  id: string;
  name: string;
  domain: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  whatsapp_phone: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_og_image: string | null;
}

@Injectable()
export class PublicTenantService {
  constructor(
    private readonly db: DbService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Obtiene las configuraciones visuales base del tenant activo en el contexto
   * RLS actual.
   *
   * Flujo con caché:
   * 1. Intenta leer la llave `tenant:{tenantId}:config` desde Redis.
   * 2. Si hay HIT → devuelve el valor cacheado (sin consultar Postgres).
   * 3. Si hay MISS → consulta Postgres, guarda el resultado en Redis y devuelve.
   *
   * Esta consulta se ejecuta automáticamente acotada al tenant resuelto por el
   * `PublicTenantInterceptor`: Postgres aplica `SET LOCAL app.current_tenant_id`
   * antes del SELECT, por lo que el RLS retorna únicamente las filas del tenant
   * correcto sin ningún filtro manual en el código.
   *
   * @returns Las configuraciones visuales del tenant (colores, logo, nombre, whatsapp).
   */
  async getTenantPublicConfig(): Promise<TenantPublicConfig | null> {
    // Leemos el tenantId del contexto ALS para construir la llave de caché.
    const tenantId = this.db.als.getStore()?.tenantId;

    if (tenantId) {
      const cacheKey = tenantConfigKey(tenantId);

      // 1. Intento de HIT en caché
      const cached = await this.cacheManager.get<TenantPublicConfig>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. MISS → consulta a Postgres (protegida por RLS automáticamente)
    const result = await this.db.query<TenantPublicConfig>(
      `SELECT
         id,
         name,
         domain,
         primary_color,
         secondary_color,
         logo_url,
         whatsapp_phone,
         seo_title,
         seo_description,
         seo_keywords,
         seo_og_image
       FROM tenants
       LIMIT 1`,
    );

    const config = result.rows[0] ?? null;

    // 3. Guardar en caché si obtuvimos un resultado y tenemos contexto
    if (config && tenantId) {
      await this.cacheManager.set(
        tenantConfigKey(tenantId),
        config,
        CACHE_TTL_TENANT_CONFIG_MS,
      );
    }

    return config;
  }

  /**
   * Obtiene los slugs de todos los productos en estado 'ACTIVE' de este tenant
   * para la generación dinámica del sitemap.
   */
  async getTenantSitemap(): Promise<Array<{ slug: string; updated_at: string }>> {
    const result = await this.db.query<{ slug: string; updated_at: string }>(
      `SELECT
         slug,
         updated_at::text
       FROM products
       WHERE status = 'ACTIVE'
       ORDER BY updated_at DESC`,
    );
    return result.rows;
  }
}
