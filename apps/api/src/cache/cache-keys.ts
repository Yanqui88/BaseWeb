/**
 * @file cache-keys.ts
 * @description Constantes y helpers para construir las llaves de caché Redis
 * de forma centralizada, garantizando consistencia entre el código que guarda
 * y el código que invalida.
 */

/** TTL de caché en milisegundos para configuración de tenant (5 minutos). */
export const CACHE_TTL_TENANT_CONFIG_MS = 5 * 60 * 1000;

/** TTL de caché en milisegundos para el catálogo de productos (2 minutos). */
export const CACHE_TTL_CATALOG_MS = 2 * 60 * 1000;

/**
 * Construye la llave de caché para la configuración pública de un tenant.
 *
 * @param tenantId - UUID del tenant.
 * @returns Llave Redis (ej: `"tenant:abc-123:config"`).
 */
export function tenantConfigKey(tenantId: string): string {
  return `tenant:${tenantId}:config`;
}

/**
 * Construye la llave de caché para el catálogo de productos de una sucursal.
 *
 * @param tenantId   - UUID del tenant.
 * @param locationId - UUID de la sucursal (o `"all"` si no se filtra por sucursal).
 * @returns Llave Redis (ej: `"tenant:abc-123:catalog:loc-456"`).
 */
export function tenantCatalogKey(tenantId: string, locationId: string | undefined): string {
  return `tenant:${tenantId}:catalog:${locationId ?? 'all'}`;
}
