/**
 * @file public-tenant.interceptor.ts
 * @description Interceptor público que resuelve el tenant a partir del header
 * `x-tenant-domain` y activa el contexto de aislamiento RLS para el resto
 * del ciclo de vida de la petición HTTP.
 *
 * **Flujo:**
 * ```
 * Request (x-tenant-domain: tienda-abc.com)
 *   → PublicTenantInterceptor
 *     → SELECT id FROM tenants WHERE domain = $1  [sin RLS, modo sistema]
 *     → als.run({ tenantId: '<uuid>' }, callback)
 *       → Controller → Service → DbService.query()
 *         → BEGIN
 *         → SET LOCAL app.current_tenant_id = '<uuid>'
 *         → [SQL del desarrollador — protegido por RLS automáticamente]
 *         → COMMIT
 * ```
 *
 * **Diferencia con `TenantInterceptor`:**
 * - `TenantInterceptor` resuelve el tenant por `:tenantSlug` en la URL (rutas admin).
 * - `PublicTenantInterceptor` resuelve por el header `x-tenant-domain` (rutas públicas).
 *   Este esquema permite que el front de Next.js (apps/store) envíe el dominio del
 *   visitante sin exponer el slug interno en las URLs públicas.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DbService } from '../db/db.service.js';
import { RlsContext } from '../db/rls-context.interface.js';

/** Fila retornada por la consulta de resolución de tenant. */
interface TenantRow {
  id: string;
}

@Injectable()
export class PublicTenantInterceptor implements NestInterceptor {
  constructor(private readonly db: DbService) {}

  /**
   * Intercepta cada petición entrante en las rutas públicas.
   *
   * 1. Lee el header `x-tenant-domain`.
   * 2. Si no existe o está vacío, lanza `NotFoundException` — las rutas públicas
   *    siempre necesitan un dominio para saber a qué tenant pertenecen.
   * 3. Realiza un `SELECT` directo al pool (sin contexto RLS activo, ya que
   *    `tenants` es una tabla de sistema global sin políticas RLS) para obtener
   *    el `tenant_id` correspondiente al dominio.
   * 4. Envuelve el Observable del handler dentro de `als.run()` con el
   *    `RlsContext` activo, garantizando el aislamiento de datos downstream.
   *
   * @param context - Contexto de ejecución NestJS.
   * @param next    - Handler que representa el resto del pipeline.
   * @returns Observable de la respuesta, envuelto en el contexto RLS correcto.
   * @throws NotFoundException si el dominio no corresponde a ningún tenant activo.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    let rawDomain: string | undefined = request.headers['x-tenant-domain'];

    if (!rawDomain || rawDomain.trim() === '') {
      throw new NotFoundException(
        'El header "x-tenant-domain" es obligatorio para las rutas públicas.',
      );
    }

    // Limpiar el dominio: quitar puerto y sufijos base
    let domain = rawDomain.split(':')[0];
    const rootDomain = process.env.ROOT_DOMAIN || 'localhost';
    
    // Si estamos en localhost, quitar .localhost
    if (domain.endsWith('.localhost')) {
      domain = domain.replace('.localhost', '');
    } else if (rootDomain && domain.endsWith('.' + rootDomain)) {
      domain = domain.replace('.' + rootDomain, '');
    }

    // ──────────────────────────────────────────────────────────────────────
    // Resolución del tenant usando acceso directo al pool (isSuperAdmin=true).
    //
    // Usamos als.run({ isSuperAdmin: true }, ...) para garantizar que la
    // consulta se ejecute con los SET LOCAL correctos en Postgres incluso si
    // en el futuro se añade RLS a tablas auxiliares. Para la tabla `tenants`
    // esto no es estrictamente necesario hoy, pero es más seguro y coherente
    // con la arquitectura general del sistema.
    // ──────────────────────────────────────────────────────────────────────
    let tenantId: string;

    await new Promise<void>((resolve, reject) => {
      this.db.als.run({ isSuperAdmin: true }, async () => {
        try {
          const result = await this.db.query<TenantRow>(
            'SELECT id FROM tenants WHERE domain = $1',
            [domain.trim().toLowerCase()],
          );

          if (!result.rows[0]) {
            reject(
              new NotFoundException(
                `No existe ningún tenant registrado para el dominio '${domain}'.`,
              ),
            );
            return;
          }

          tenantId = result.rows[0].id;
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    // Construimos el contexto RLS con el tenantId resuelto.
    const rlsContext: RlsContext = { tenantId: tenantId! };

    /**
     * Envolvemos el Observable de RxJS dentro de `als.run()` con el contexto
     * de tenant real. A partir de aquí, cualquier llamada a `DbService.query()`
     * o `DbService.transaction()` emitirá automáticamente:
     *   SET LOCAL app.current_tenant_id = '<uuid>'
     * antes de ejecutar el SQL del desarrollador, sin necesidad de filtros WHERE
     * manuales en el código de negocio.
     */
    return new Observable((observer) => {
      this.db.als.run(rlsContext, () => {
        const subscription = next.handle().subscribe({
          next: (val) => observer.next(val),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });

        // Función de teardown para limpiar la suscripción si el cliente cancela.
        return () => subscription.unsubscribe();
      });
    });
  }
}
