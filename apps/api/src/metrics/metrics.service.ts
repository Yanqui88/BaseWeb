import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { DbService } from '../db/db.service.js';

/**
 * Interfaz que describe la forma del objeto retornado por `getStats()`.
 * Facilita el tipado estricto en el controlador y en posibles tests futuros.
 */
export interface SystemStats {
  /** Memoria del proceso Node.js en bytes, desglosada por categoría. */
  memory: NodeJS.MemoryUsage;
  /** Promedio de carga del sistema en los últimos 1, 5 y 15 minutos. */
  loadAvg: number[];
  /** Segundos transcurridos desde que el proceso Node.js fue iniciado. */
  uptimeSeconds: number;
  /** Estadísticas actuales del pool de conexiones PostgreSQL. */
  pool: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

/**
 * Servicio de métricas del sistema.
 *
 * Agrega información operacional de bajo costo (sin dependencias externas)
 * útil para monitorear la salud de la aplicación en un VPS con recursos
 * limitados (2 GB RAM) donde no se puede correr Grafana/Prometheus.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly db: DbService) {}

  /**
   * Verifica la conectividad con la base de datos ejecutando un query trivial.
   *
   * Ejecuta `SELECT 1` directamente sin contexto RLS (no requiere tenant),
   * lo que garantiza que el check sea puro y no afecte el ALS.
   *
   * @returns `true` si la base de datos responde correctamente.
   * @throws Propaga el error original de `pg` si la conexión falla.
   */
  async checkDatabaseHealth(): Promise<boolean> {
    await this.db.query('SELECT 1');
    return true;
  }

  /**
   * Recopila métricas del proceso Node.js y del pool de conexiones SQL.
   *
   * Todos los valores se obtienen de APIs nativas del runtime (`process`,
   * módulo `os`) o del pool `pg`, sin consultas costosas a la base de datos.
   *
   * @returns Objeto `SystemStats` con memoria, carga, uptime y stats del pool.
   */
  getStats(): SystemStats {
    return {
      memory: process.memoryUsage(),
      loadAvg: os.loadavg(),
      uptimeSeconds: process.uptime(),
      pool: this.db.getPoolStats(),
    };
  }
}
