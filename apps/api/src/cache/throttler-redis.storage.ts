/**
 * @file throttler-redis.storage.ts
 * @description Implementación de `ThrottlerStorage` de @nestjs/throttler
 * respaldada por Redis (ioredis), para compartir contadores entre múltiples
 * instancias del API en entornos de producción con load balancing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISEÑO:
 * ─────────────────────────────────────────────────────────────────────────────
 * - Instanciada directamente (no como proveedor NestJS) en ThrottlerModule.forRoot().
 * - Cada clave en Redis: "throttler:<throttlerName>:<key>"
 * - INCR + EXPIRE para contadores atómicos.
 * - TTL se establece solo en el primer hit.
 * - Fail-open: si Redis no está disponible, NO bloquea las requests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/** Prefijo para todas las claves de throttler en Redis. */
const THROTTLER_KEY_PREFIX = 'throttler';

export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly redis: Redis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

    try {
      this.redis = redisUrl
        ? new Redis(redisUrl, { lazyConnect: false, enableReadyCheck: false, maxRetriesPerRequest: 1 })
        : new Redis({ host, port, lazyConnect: false, enableReadyCheck: false, maxRetriesPerRequest: 1 });

      this.redis.on('error', (err: Error) => {
        // Suprimir logs repetitivos de errores de conexión
        if (!err.message.includes('ECONNREFUSED')) {
          console.warn(`[ThrottlerRedisStorage] Redis error: ${err.message}`);
        }
      });
    } catch {
      this.redis = null;
    }
  }

  /**
   * Incrementa el contador de solicitudes para una clave dada.
   *
   * @param key           - Clave única por IP + ruta + throttler.
   * @param ttl           - Tiempo de vida en milisegundos.
   * @param limit         - Máximo de solicitudes permitidas.
   * @param blockDuration - Duración adicional de bloqueo (ms).
   * @param throttlerName - Nombre del throttler (short/medium/long).
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `${THROTTLER_KEY_PREFIX}:${throttlerName}:${key}`;
    const ttlSeconds = Math.ceil(ttl / 1000);

    // Si Redis no está disponible, retornamos un record que no bloquea (fail-open)
    if (!this.redis || this.redis.status === 'end' || this.redis.status === 'close') {
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);
      const results = await pipeline.exec();

      const totalHits = (results?.[0]?.[1] as number) ?? 1;
      const remainingTtl = (results?.[1]?.[1] as number) ?? -1;

      // Establecer TTL solo si la clave no lo tiene aún (primer hit)
      if (remainingTtl === -1 || remainingTtl === -2) {
        await this.redis.expire(redisKey, ttlSeconds);
      }

      const timeToExpire = remainingTtl > 0 ? remainingTtl * 1000 : ttl;
      const isBlocked = totalHits > limit;

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? blockDuration : 0,
      };
    } catch {
      // Fail-open: no bloquear si Redis falla
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
