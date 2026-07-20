import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

/**
 * Módulo de métricas internas del sistema.
 *
 * Registra el `MetricsController` y `MetricsService` que exponen los endpoints
 * `GET /metrics/health` y `GET /metrics/stats`, ambos protegidos por
 * `AdminApiKeyGuard`.
 *
 * `DbService` está disponible aquí porque `DbModule` es `@Global()`.
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
