/**
 * @file tenant.interceptor.ts
 * @description Interceptor HTTP que activa el contexto de seguridad RLS para
 * peticiones multi-tenant.
 *
 * **Responsabilidad única:** Leer el parámetro `:tenantSlug` de la URL,
 * resolver el `tenantId` real desde la base de datos, y envolver el flujo
 * asíncrono de la petición dentro de un `AsyncLocalStorage.run()` con el
 * `RlsContext` correspondiente, para que el `DbService` aplique automáticamente
 * las políticas RLS de PostgreSQL.
 *
 * **¿Cuándo NO actúa?** Si la ruta no contiene el parámetro `:tenantSlug`
 * (ej. `/health`, `/superadmin/*`), el interceptor cede el control sin modificar
 * el contexto ALS, y las consultas se ejecutarán sin filtro RLS (modo sistema).
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DbService } from './db.service.js';
import { RlsContext } from './rls-context.interface.js';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly db: DbService) {}

  /**
   * Intercepta cada petición HTTP entrante.
   *
   * 1. Extrae `:tenantSlug` de los parámetros de ruta.
   * 2. Si no existe, delega directamente al siguiente handler (sin contexto RLS).
   * 3. Si existe, busca el tenant en la base de datos.
   * 4. Envuelve el observable del handler dentro de `als.run()` con el `RlsContext`
   *    activo, garantizando que todas las consultas downstream apliquen RLS.
   *
   * @param context - Contexto de ejecución de NestJS (HTTP, WS, RPC).
   * @param next    - Handler que representa el resto del pipeline de la petición.
   * @returns Observable con la respuesta del handler, envuelto en el contexto RLS.
   * @throws NotFoundException si el slug no corresponde a ningún tenant registrado.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantSlug: string | undefined = request.params.tenantSlug;
    
    // Si la ruta no tiene tenantSlug, intentamos obtener el tenantId del JWT del usuario
    let tenantId = request.user?.tenantId;

    if (!tenantId && tenantSlug) {
      // Resolvemos el tenant desde la base de datos usando el slug de la URL.
      const tenant = await this.db.getTenantBySlug(tenantSlug);
      if (!tenant) {
        throw new NotFoundException(
          `La tienda con el identificador '${tenantSlug}' no existe.`,
        );
      }
      tenantId = tenant.id;
    }

    // Ruta sin tenant (p.ej. endpoints de sistema o superadmin): flujo normal.
    if (!tenantId) {
      return next.handle();
    }

    // Construimos el contexto RLS con el tenantId resuelto.
    const rlsContext: RlsContext = { tenantId };

    /**
     * Envolvemos el Observable de RxJS dentro de `als.run()`.
     *
     * IMPORTANTE: `als.run()` es síncrono y establece el contexto para todo
     * el árbol de llamadas asíncronas que se genere a partir de ese punto.
     * Al envolver el subscribe dentro del callback, garantizamos que cualquier
     * consulta a `DbService.query()` o `DbService.transaction()` que ocurra
     * durante la vida del observable lea el `tenantId` correcto del ALS.
     */
    return new Observable((observer) => {
      this.db.als.run(rlsContext, () => {
        const subscription = next.handle().subscribe({
          next: (val) => observer.next(val),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });

        // Retornamos la función de teardown para limpiar la suscripción.
        return () => subscription.unsubscribe();
      });
    });
  }
}
