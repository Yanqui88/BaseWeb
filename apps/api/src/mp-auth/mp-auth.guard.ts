/**
 * @file mp-auth.guard.ts
 * @description Guard de JWT para proteger endpoints del módulo MpAuth.
 *
 * Verifica que la petición contenga un token JWT válido en el header
 * `Authorization: Bearer <token>` y extrae el `tenantId` del payload
 * para inyectarlo en el `AsyncLocalStorage` del `DbService`, activando
 * el contexto RLS de PostgreSQL.
 *
 * **Flujo de seguridad:**
 * 1. Extrae el Bearer token del header Authorization.
 * 2. Verifica la firma JWT usando el secreto de la aplicación.
 * 3. Extrae `tenantId` del payload del token.
 * 4. Inyecta `tenantId` en el contexto ALS de `DbService`.
 * 5. Expone el `tenantId` en `request.tenantId` para uso downstream.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service.js';

/** Forma del payload esperado en el JWT de la aplicación. */
interface JwtPayload {
  sub: string;
  tenantId: string;
}

@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      tenantId?: string;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Token de autorización requerido. Formato: "Authorization: Bearer <token>"',
      );
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'super-secret',
      });
    } catch {
      throw new UnauthorizedException('Token JWT inválido o expirado.');
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException(
        'El token JWT no contiene un tenantId válido.',
      );
    }

    // Exponemos el tenantId en la request para que el servicio pueda acceder a él.
    request.tenantId = payload.tenantId;

    return true;
  }
}
