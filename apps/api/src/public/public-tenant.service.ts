/**
 * @file public-tenant.service.ts
 * @description Servicio que encapsula la lógica de consulta de configuraciones
 * visuales públicas de un tenant.
 *
 * IMPORTANTE: Este servicio NO añade filtros `WHERE tenant_id = ?` manuales.
 * El aislamiento por tenant lo garantiza el RLS de PostgreSQL, activado
 * automáticamente por el `PublicTenantInterceptor` antes de que este método
 * sea invocado.
 */

import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

/** Configuración visual pública de un tenant. */
export interface TenantPublicConfig {
  id: string;
  name: string;
  domain: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

@Injectable()
export class PublicTenantService {
  constructor(private readonly db: DbService) {}

  /**
   * Obtiene las configuraciones visuales base del tenant activo en el contexto
   * RLS actual.
   *
   * Esta consulta se ejecuta automáticamente acotada al tenant resuelto por el
   * `PublicTenantInterceptor`: Postgres aplica `SET LOCAL app.current_tenant_id`
   * antes del SELECT, por lo que el RLS retorna únicamente las filas del tenant
   * correcto sin ningún filtro manual en el código.
   *
   * @returns Las configuraciones visuales del tenant (colores, logo, nombre).
   */
  async getTenantPublicConfig(): Promise<TenantPublicConfig | null> {
    const result = await this.db.query<TenantPublicConfig>(
      `SELECT
         id,
         name,
         domain,
         primary_color,
         secondary_color,
         logo_url
       FROM tenants
       LIMIT 1`,
    );

    return result.rows[0] ?? null;
  }
}
