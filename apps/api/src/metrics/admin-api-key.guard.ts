import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard que protege rutas administrativas sensibles exigiendo que la cabecera
 * `x-api-key` coincida exactamente con la variable de entorno `ADMIN_API_KEY`.
 *
 * Diseñado para endpoints de métricas internas donde no se quiere exponer
 * información del sistema sin autenticación, sin la complejidad de JWT.
 *
 * @throws {ForbiddenException} Si la cabecera está ausente o no coincide.
 *
 * @example
 * // Aplicar al controlador completo:
 * \@UseGuards(AdminApiKeyGuard)
 * \@Controller('metrics')
 * export class MetricsController {}
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey) {
      throw new ForbiddenException(
        'ADMIN_API_KEY no está configurada en el servidor.',
      );
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new ForbiddenException('API Key inválida o ausente.');
    }

    return true;
  }
}
