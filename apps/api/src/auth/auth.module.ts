/**
 * @file auth.module.ts
 * @description Módulo de autenticación para administradores de tenant.
 *
 * Registra el JwtModule con un secreto configurable via variable de entorno
 * y un tiempo de expiración corto (15 minutos) para los access tokens.
 * Los refresh tokens (7 días) se persisten en la tabla `sessions` de Postgres.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
