/**
 * @file mp-auth.module.ts
 * @description Módulo NestJS para la integración OAuth de Mercado Pago.
 *
 * Agrupa el controller y service que gestionan el flujo de vinculación de cuentas
 * de Mercado Pago mediante el código de autorización OAuth.
 *
 * **Dependencias:**
 * - `HttpModule` (`@nestjs/axios`): Para realizar la petición POST al endpoint
 *   de token de Mercado Pago.
 * - `DbModule` (global): Provee `DbService` automáticamente via el decorador `@Global()`.
 *   No es necesario importarlo explícitamente aquí.
 * - `AuthModule`: Para poder utilizar `AuthService` y verificar tokens JWT en el Guard.
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MpAuthController } from './mp-auth.controller.js';
import { MpAuthService } from './mp-auth.service.js';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    HttpModule,
    // Re-registramos JwtModule para que el guard local del módulo pueda
    // verificar tokens sin depender de la exportación del AuthModule.
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
    }),
  ],
  controllers: [MpAuthController],
  providers: [MpAuthService],
})
export class MpAuthModule {}
