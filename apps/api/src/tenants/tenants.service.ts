/**
 * @file tenants.service.ts
 * @description Servicio para operaciones de sistema sobre la tabla `tenants`.
 *
 * Las consultas de este servicio se ejecutan SIN filtro RLS (la tabla `tenants`
 * es global y no tiene Row-Level Security habilitado). Se inyecta el Pool
 * directamente desde DbService para garantizar consultas directas y rápidas.
 *
 * NOTA: Se usa `isSuperAdmin` vía ALS para asegurar que futuras políticas RLS
 * en `tenants` (si se añaden) sean bypassadas correctamente.
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

  constructor(private readonly db: DbService) {}

  /**
   * Busca un tenant activo por su dominio personalizado.
   *
   * La consulta se ejecuta directamente sobre el pool de `pg` (sin ALS/RLS)
   * porque la tabla `tenants` es una tabla de sistema global que no aplica
   * Row-Level Security. Esto garantiza la consulta más rápida posible.
   *
   * @param domain - FQDN del tenant (ej. "tienda.example.com").
   * @returns Los datos del tenant o `null` si no existe o está inactivo.
   */
  async findActiveByDomain(domain: string): Promise<TenantRow | null> {
    // Usamos queryRaw para saltarnos el ALS y consultar directo al pool.
    const result = await this.db.queryRaw<TenantRow>(
      `SELECT id, name, domain
         FROM tenants
        WHERE domain = $1
          AND is_active = true
        LIMIT 1`,
      [domain],
    );

    return result.rows[0] ?? null;
  }
}
