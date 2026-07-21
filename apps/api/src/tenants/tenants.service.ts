/**
 * @file tenants.service.ts
 * @description Servicio para operaciones de sistema sobre la tabla `tenants`.
 *
 * Las consultas de este servicio se ejecutan SIN filtro RLS (la tabla `tenants`
 * es global y no tiene Row-Level Security habilitado). Se inyecta el Pool
 * directamente desde DbService para garantizar consultas directas y rápidas.
 *
 * Hito 11 – Fase 4: Soporte para subdominios dinámicos en verify-domain.
 *
 * Lógica de resolución de dominio:
 *   1. Si el FQDN recibido termina en `.{ROOT_DOMAIN}` (ej. `mitienda.tuplataforma.com`
 *      con ROOT_DOMAIN=tuplataforma.com), se extrae el slug (`mitienda`) y se busca
 *      en la columna `domain` de `tenants`.
 *   2. Si el FQDN NO contiene el ROOT_DOMAIN, se asume que es un dominio personalizado
 *      de marca blanca (ej. `zapatos.com`) y se busca el FQDN completo en `domain`.
 *
 * NOTA: Se usa `queryRaw` para saltarnos el ALS y consultar directo al pool.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface TenantRow {
  id: string;
  name: string;
  domain: string;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  /**
   * Dominio raíz de la plataforma SaaS, leído desde la variable de entorno
   * ROOT_DOMAIN (ej. "tuplataforma.com"). Se normaliza eliminando el punto
   * inicial si el operador lo incluye por error.
   */
  private readonly rootDomain: string = (
    process.env.ROOT_DOMAIN ?? ''
  ).replace(/^\./, '').toLowerCase();

  constructor(private readonly db: DbService) {}

  /**
   * Extrae el slug del tenant a partir del FQDN recibido de Caddy.
   *
   * Ejemplos con ROOT_DOMAIN="tuplataforma.com":
   *   - "mitienda.tuplataforma.com"  → slug: "mitienda"  (subdominio SaaS)
   *   - "zapatos.com"                → slug: "zapatos.com" (dominio personalizado)
   *   - "localhost"                  → slug: "localhost"  (desarrollo local)
   *
   * @param fqdn - Dominio completo tal como lo envía Caddy.
   * @returns El slug a buscar en la tabla `tenants.domain`.
   */
  private extractSlug(fqdn: string): string {
    const host = fqdn.toLowerCase().trim();

    // Si ROOT_DOMAIN está configurado y el host es un subdominio de él:
    // ej. "mitienda.tuplataforma.com" → suffix ".tuplataforma.com"
    if (this.rootDomain && host.endsWith(`.${this.rootDomain}`)) {
      // Quita el suffix para obtener el slug puro.
      const slug = host.slice(0, host.length - this.rootDomain.length - 1);
      this.logger.debug(
        `[extractSlug] Subdominio SaaS detectado: "${fqdn}" → slug: "${slug}"`,
      );
      return slug;
    }

    // Dominio personalizado (marca blanca) o entorno local → usar el FQDN completo.
    this.logger.debug(
      `[extractSlug] Dominio personalizado/local: "${fqdn}" → slug: "${host}"`,
    );
    return host;
  }

  /**
   * Busca un tenant activo por su dominio.
   *
   * Soporta dos modos:
   *   A) Subdominio dinámico SaaS (ej. "mitienda.tuplataforma.com") →
   *      extrae el slug y busca `domain = 'mitienda'`.
   *   B) Dominio personalizado (ej. "zapatos.com") →
   *      busca `domain = 'zapatos.com'` (slug = FQDN completo).
   *
   * La consulta se ejecuta directamente sobre el pool de `pg` (sin ALS/RLS)
   * porque la tabla `tenants` es una tabla de sistema global.
   *
   * @param fqdn - FQDN completo recibido de Caddy (ej. "mitienda.tuplataforma.com").
   * @returns Los datos del tenant o `null` si no existe o está inactivo.
   */
  async findActiveByDomain(fqdn: string): Promise<TenantRow | null> {
    const slug = this.extractSlug(fqdn);

    // Usamos queryRaw para saltarnos el ALS y consultar directo al pool.
    const result = await this.db.queryRaw<TenantRow>(
      `SELECT id, name, domain
         FROM tenants
        WHERE domain = $1
          AND is_active = true
        LIMIT 1`,
      [slug],
    );

    return result.rows[0] ?? null;
  }
}
