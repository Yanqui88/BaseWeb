/**
 * @file cache.module.ts
 * @description Módulo global de caché basado en Redis para NestJS.
 *
 * Configura CacheModule con el store de Redis usando @keyv/redis + Keyv,
 * compatible con @nestjs/cache-manager v3+ (que usa keyv internamente).
 *
 * Variables de entorno soportadas:
 *   - REDIS_URL  → URL completa de Redis (ej: "redis://localhost:6379")
 *   - REDIS_HOST → Host de Redis (usa puerto 6379 por defecto)
 *
 * Si no se define ninguna variable, el módulo usa un store en memoria como
 * fallback seguro (útil para entornos de desarrollo sin Redis).
 */

import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import Keyv from 'keyv';
import { CacheRevalidationService } from './cache-revalidation.service.js';

/** TTL por defecto: 5 minutos en milisegundos. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function buildRedisUrl(): string | undefined {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (process.env.REDIS_HOST) {
    return `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT ?? '6379'}`;
  }
  return undefined;
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (): any => {
        const redisUrl = buildRedisUrl();

        if (!redisUrl) {
          // Fallback: store en memoria integrado de cache-manager (sin Redis)
          console.warn(
            '[CacheModule] ⚠️  Sin REDIS_URL/REDIS_HOST. Usando store en memoria (no distribuido).',
          );
          return { ttl: DEFAULT_TTL_MS };
        }

        console.log(`[CacheModule] ✅ Conectando a Redis → ${redisUrl}`);

        // KeyvRedis implementa KeyvStoreAdapter (interfaz compatible con @nestjs/cache-manager v3)
        const keyvRedis = new KeyvRedis(redisUrl);
        const store = new Keyv({ store: keyvRedis, ttl: DEFAULT_TTL_MS });

        return {
          stores: store,
          ttl: DEFAULT_TTL_MS,
        };
      },
    }),
  ],
  providers: [CacheRevalidationService],
  exports: [CacheModule, CacheRevalidationService],
})
export class AppCacheModule {}

