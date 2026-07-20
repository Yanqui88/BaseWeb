import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

@Injectable()
export class CacheRevalidationService {
  private readonly logger = new Logger(CacheRevalidationService.name);

  constructor(private readonly db: DbService) {}

  /**
   * Realiza la revalidación de tags en Next.js.
   * Resuelve el tenant (id, slug y domain) y purga las tags correspondientes en el frontend.
   *
   * @param tenantIdOrSlug - ID o Slug del tenant.
   * @param entityTags - Array de tags cortas (ej. ['products', 'orders']) o completas (ej. ['tenant:id:products']).
   */
  async revalidate(tenantIdOrSlug: string, entityTags: string[]): Promise<void> {
    const storeUrl = process.env.STORE_URL || 'http://localhost:3000';
    const revalidateSecret = process.env.REVALIDATE_SECRET || 'super-secret-revalidation-token-2026';

    try {
      // 1. Obtener la información del tenant (id, slug y dominio)
      const tenantInfo = await this.db.als.run({ isSuperAdmin: true }, async () => {
        const result = await this.db.query<{ id: string; slug: string; domain: string }>(
          `SELECT id, slug, domain FROM tenants WHERE id = $1 OR slug = $2 LIMIT 1`,
          [tenantIdOrSlug, tenantIdOrSlug],
        );
        return result.rows[0] ?? null;
      });

      if (!tenantInfo) {
        this.logger.warn(`No se encontró tenant para revalidar usando el identificador: "${tenantIdOrSlug}"`);
        return;
      }

      const { id, slug, domain } = tenantInfo;

      // 2. Generar combinaciones de tags para revalidar.
      // Si recibimos tag 'products', revalidamos 'tenant:id:products', 'tenant:slug:products' y 'tenant:domain:products'
      const tagsToRevalidate: string[] = [];
      for (const tag of entityTags) {
        if (tag.includes(':')) {
          tagsToRevalidate.push(tag);
        } else {
          tagsToRevalidate.push(`tenant:${id}:${tag}`);
          tagsToRevalidate.push(`tenant:${slug}:${tag}`);
          if (domain) {
            tagsToRevalidate.push(`tenant:${domain}:${tag}`);
          }
        }
      }

      if (tagsToRevalidate.length === 0) {
        return;
      }

      this.logger.log(`Enviando petición de revalidación a Next.js (${storeUrl}) para las tags: ${JSON.stringify(tagsToRevalidate)}`);

      // 3. Realizar petición POST al endpoint de revalidación de Next.js
      const response = await fetch(`${storeUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-token': revalidateSecret,
        },
        body: JSON.stringify({ tags: tagsToRevalidate }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Error revalidando tags en Next.js. Status: ${response.status}. Response: ${text}`);
      } else {
        const json = await response.json();
        this.logger.log(`Revalidación exitosa en Next.js: ${JSON.stringify(json)}`);
      }
    } catch (error: any) {
      this.logger.error(`Error de red o procesamiento al revalidar caché en Next.js: ${error.message}`, error.stack);
    }
  }
}
