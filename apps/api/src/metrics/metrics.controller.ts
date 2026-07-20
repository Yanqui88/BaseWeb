import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard.js';
import { MetricsService } from './metrics.service.js';
import type { SystemStats } from './metrics.service.js';

/**
 * Controlador de métricas internas del sistema.
 *
 * Todos los endpoints están protegidos por `AdminApiKeyGuard`, que exige
 * la cabecera `x-api-key` con el valor de `ADMIN_API_KEY`.
 *
 * Base path: `/metrics`
 *
 * Rutas disponibles:
 * - `GET /metrics/health` — Verifica conectividad con la DB.
 * - `GET /metrics/stats`  — Retorna métricas de memoria, CPU y pool SQL.
 */
@UseGuards(AdminApiKeyGuard)
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Verifica que la aplicación y la base de datos estén operativas.
   *
   * Ejecuta `SELECT 1` en PostgreSQL para confirmar conectividad.
   * Útil para health checks de orquestadores (Docker, systemd, etc.)
   * que monitorizan la disponibilidad del servicio.
   *
   * @returns `{ status: 'ok' }` si la DB responde correctamente.
   * @throws {InternalServerErrorException} Si la DB no responde.
   *
   * @example
   * // curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:4000/metrics/health
   * // { "status": "ok" }
   */
  @Get('health')
  async checkHealth(): Promise<{ status: string }> {
    try {
      await this.metricsService.checkDatabaseHealth();
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Health check fallido:', error);
      throw new InternalServerErrorException({
        status: 'error',
        message: 'La base de datos no responde.',
      });
    }
  }

  /**
   * Retorna un snapshot de las métricas operacionales del sistema.
   *
   * Datos devueltos (todos obtenidos de APIs nativas del runtime):
   * - `memory`       — Uso de memoria del proceso Node.js (RSS, heap, etc.).
   * - `loadAvg`      — Carga del sistema [1 min, 5 min, 15 min].
   * - `uptimeSeconds`— Tiempo de vida del proceso en segundos.
   * - `pool`         — Estado actual del pool `pg` (total, idle, waiting).
   *
   * @returns Objeto `SystemStats` serializado como JSON.
   *
   * @example
   * // curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:4000/metrics/stats
   * // {
   * //   "memory": { "rss": 52428800, "heapTotal": 20971520, ... },
   * //   "loadAvg": [0.12, 0.08, 0.05],
   * //   "uptimeSeconds": 3600.5,
   * //   "pool": { "totalCount": 5, "idleCount": 4, "waitingCount": 0 }
   * // }
   */
  @Get('stats')
  getStats(): SystemStats {
    return this.metricsService.getStats();
  }
}
