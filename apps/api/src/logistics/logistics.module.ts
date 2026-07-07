/**
 * @file logistics.module.ts
 * @description Módulo NestJS para la integración de logística y cotización de envíos.
 *
 * **Responsabilidades:**
 * - Exponer el endpoint `POST /logistics/quote` para uso del frontend de la tienda pública.
 * - Orquestar la autenticación y cotización contra la API de Andreani.
 * - Resolver el tenant activo desde el header `x-tenant-domain` mediante `PublicTenantInterceptor`.
 *
 * **Dependencias:**
 * - `DbModule` (global, marcado con `@Global()`): Provee `DbService` automáticamente sin necesidad
 *   de importarlo explícitamente aquí.
 * - `AndreaniService`: Servicio de integración HTTP con la API de Andreani.
 * - `PublicTenantInterceptor`: Resuelve el tenant desde el header HTTP y activa el contexto RLS.
 *
 * **Sin dependencias HTTP externas adicionales**: Se usa `fetch` nativo de Node.js 18+.
 */

import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller.js';
import { LogisticsService } from './logistics.service.js';
import { AndreaniService } from './providers/andreani.service.js';
import { PublicTenantInterceptor } from '../public/public-tenant.interceptor.js';

@Module({
  controllers: [LogisticsController],
  providers: [
    LogisticsService,
    AndreaniService,
    PublicTenantInterceptor,
  ],
})
export class LogisticsModule {}
