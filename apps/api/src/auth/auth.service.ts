/**
 * @file auth.service.ts
 * @description Servicio de autenticación para administradores de tenant.
 *
 * Implementa el flujo completo de login:
 * 1. Búsqueda del usuario por email usando contexto isSuperAdmin para bypassear RLS.
 * 2. Verificación de contraseña con bcrypt.
 * 3. Emisión de un access_token JWT (15 min) y un refresh_token criptográfico (7 días).
 * 4. Persistencia del refresh_token en la tabla `sessions` bajo contexto del tenant.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DbService } from '../db/db.service.js';

/** Forma del registro de usuario recuperado de Postgres. */
interface UserRow {
  id: string;
  tenant_id: string;
  password_hash: string;
}

/** Respuesta del método login. */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  tenant_id: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Autentica a un administrador de tenant dado su email y contraseña.
   *
   * @param email    - Email del administrador.
   * @param password - Contraseña en texto plano.
   * @returns Objeto con access_token, refresh_token y tenant_id.
   * @throws UnauthorizedException si las credenciales son inválidas.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // ── 1. Buscar usuario por email usando contexto isSuperAdmin ───────────
    // Al correr con isSuperAdmin = true, el DbService emite
    // `SET LOCAL app.is_superadmin = 'true'` antes de la consulta,
    // permitiendo leer la tabla `users` sin importar el tenant_id del registro.
    const user = await this.db.als.run(
      { isSuperAdmin: true },
      async () => {
        const result = await this.db.query<UserRow>(
          `SELECT id, tenant_id, password_hash
           FROM users
           WHERE email = $1
           LIMIT 1`,
          [email],
        );
        return result.rows[0] ?? null;
      },
    );

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // ── 2. Verificar contraseña con bcrypt ─────────────────────────────────
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // ── 3. Generar tokens ──────────────────────────────────────────────────
    const access_token = this.jwt.sign({
      sub: user.id,
      tenantId: user.tenant_id,
    });

    const refresh_token = crypto.randomBytes(32).toString('hex');

    // ── 4. Persistir sesión en Postgres bajo contexto del tenant ──────────
    // Ejecutamos con tenantId para que las políticas RLS permitan el INSERT
    // en la tabla sessions (que tiene RLS habilitado).
    await this.db.als.run({ tenantId: user.tenant_id }, async () => {
      await this.db.query(
        `INSERT INTO sessions (tenant_id, user_id, token, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
        [user.tenant_id, user.id, refresh_token],
      );
    });

    return {
      access_token,
      refresh_token,
      tenant_id: user.tenant_id,
    };
  }
}
