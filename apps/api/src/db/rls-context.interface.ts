/**
 * @file rls-context.interface.ts
 * @description Define el contrato del contexto de seguridad RLS (Row-Level Security)
 * que se propaga a través de `AsyncLocalStorage` por toda la cadena asíncrona de
 * una petición HTTP. Este contexto es el corazón del aislamiento multi-tenant.
 */

/**
 * Contexto de seguridad almacenado en `AsyncLocalStorage` por cada petición HTTP.
 *
 * Dependiendo de qué campos estén presentes, el `DbService` aplicará distintas
 * variables de sesión en PostgreSQL antes de ejecutar una consulta:
 *
 * - Si `tenantId` está presente → `SET LOCAL app.current_tenant_id = '<uuid>';`
 * - Si `isSuperAdmin` es `true`  → `SET LOCAL app.is_superadmin = 'true';`
 *
 * Ambos valores pueden coexistir (p.ej. un superadmin que opera dentro del
 * contexto de un tenant específico con fines de auditoría).
 */
export interface RlsContext {
  /**
   * UUID del tenant activo en la petición actual.
   * Si está presente, Postgres filtrará automáticamente las filas mediante RLS
   * usando la política `app.current_tenant_id`.
   */
  tenantId?: string;

  /**
   * Indica si el usuario autenticado es el superadministrador de la plataforma.
   * Cuando es `true`, el `DbService` emite `SET LOCAL app.is_superadmin = 'true'`,
   * lo que permite a las políticas RLS conceder acceso irrestricto a la fila.
   */
  isSuperAdmin?: boolean;
}
