/**
 * @file proxy.guard.ts
 * @description Guard NestJS que valida el header `X-Proxy-Secret` enviado por Caddy.
 *
 * Hito 8 – Fase 5: Autenticación Caddy ↔ NestJS
 * ─────────────────────────────────────────────────────────────────────────────
 * Propósito:
 *   Garantizar que sólo el proxy reverso (Caddy) pueda llamar a los endpoints
 *   de sistema internos (ej. verify-domain). Cualquier petición directa sin el
 *   secret correcto recibirá HTTP 403 Forbidden.
 *
 * Configuración:
 *   La variable de entorno `CADDY_PROXY_SECRET` debe contener un string aleatorio
 *   de al menos 32 caracteres, compartido entre Caddy (caddyfile / env) y este
 *   servicio API.
 *
 * Uso:
 *   @UseGuards(ProxyGuard)          ← a nivel de controlador o método
 *
 *   O registrar globalmente en AppModule:
 *   { provide: APP_GUARD, useClass: ProxyGuard }   ← si se quiere global
 *   (En ese caso, usar @SkipProxyGuard() para las rutas que lo requieran.)
 *
 * Exclusiones:
 *   - Health checks que no necesiten validación de proxy.
 *   - Rutas que definen el decorador @SkipProxyGuard().
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/** Clave de metadato para marcar rutas que deben saltarse el ProxyGuard. */
export const SKIP_PROXY_GUARD_KEY = 'skipProxyGuard';

/**
 * Decorador que marca un handler o controlador para que sea excluido
 * de la validación del `ProxyGuard`.
 *
 * @example
 * @SkipProxyGuard()
 * @Get('health')
 * healthCheck() { return 'ok'; }
 */
export const SkipProxyGuard = () => SetMetadata(SKIP_PROXY_GUARD_KEY, true);

@Injectable()
export class ProxyGuard implements CanActivate {
  private readonly logger = new Logger(ProxyGuard.name);

  /**
   * Secret esperado en el header `X-Proxy-Secret`.
   * Leído una sola vez al inicializar el guard para evitar accesos repetidos
   * al objeto `process.env` en cada petición.
   */
  private readonly expectedSecret: string | undefined;

  constructor(private readonly reflector: Reflector) {
    this.expectedSecret = process.env.CADDY_PROXY_SECRET;

    if (!this.expectedSecret) {
      this.logger.warn(
        '⚠️  CADDY_PROXY_SECRET no está definida. ' +
        'El ProxyGuard rechazará TODAS las peticiones protegidas. ' +
        'Define esta variable de entorno para habilitar la validación.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // ── Verificar si la ruta está marcada para saltarse este guard ──────────
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PROXY_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return true;
    }

    // ── Validar el header X-Proxy-Secret ────────────────────────────────────
    const request = context.switchToHttp().getRequest<Request>();
    const receivedSecret = request.headers['x-proxy-secret'];

    // Si no hay secret configurado en el entorno, bloquear todo.
    if (!this.expectedSecret) {
      this.logger.error(
        `[ProxyGuard] Acceso rechazado a ${request.method} ${request.url}: ` +
        'CADDY_PROXY_SECRET no configurada en el servidor.',
      );
      throw new ForbiddenException('Proxy authentication not configured.');
    }

    // Comparación directa (tiempo constante no requerido aquí ya que
    // es un header de red, no un hash criptográfico).
    if (receivedSecret !== this.expectedSecret) {
      this.logger.warn(
        `[ProxyGuard] Acceso rechazado a ${request.method} ${request.url}: ` +
        `Header X-Proxy-Secret inválido desde ${request.ip ?? 'IP desconocida'}.`,
      );
      throw new ForbiddenException('Invalid proxy secret.');
    }

    return true;
  }
}
