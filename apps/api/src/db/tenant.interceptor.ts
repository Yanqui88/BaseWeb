import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DbService } from './db.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private db: DbService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantSlug = request.params.tenantSlug;

    // Si el endpoint no posee ':tenantSlug' en su ruta, se ejecuta la petición de manera normal.
    if (!tenantSlug) {
      return next.handle();
    }

    // Buscamos el tenant por su slug
    const tenant = await this.db.getTenantBySlug(tenantSlug);
    
    if (!tenant) {
      throw new NotFoundException(`La tienda con el identificador '${tenantSlug}' no existe.`);
    }

    // Ejecutamos la petición envolviendo el flujo asíncrono (RxJS Observable)
    // dentro de AsyncLocalStorage con el tenantId correspondiente.
    return new Observable((observer) => {
      this.db.als.run({ tenantId: tenant.id }, () => {
        const subscription = next.handle().subscribe({
          next: (val) => observer.next(val),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
        
        return () => subscription.unsubscribe();
      });
    });
  }
}
