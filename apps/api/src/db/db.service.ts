/**
 * @file db.service.ts
 * @description Servicio central de acceso a la base de datos PostgreSQL.
 *
 * Arquitectura clave:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Pool de conexiones (`pg`)**: Gestiona un pool de conexiones nativas con
 *    Postgres. NO se utiliza ningún ORM (Prisma, TypeORM, etc.) para mantener
 *    control total sobre el SQL y eliminar overhead en memoria.
 *
 * 2. **AsyncLocalStorage (ALS)**: Almacena el contexto de seguridad
 *    (`RlsContext`) de forma asíncrona durante toda la cadena de ejecución de
 *    una petición HTTP, sin necesidad de pasar el contexto como parámetro
 *    a cada función. Funciona de forma análoga a `ThreadLocal` en Java.
 *
 * 3. **Corazón del RLS**: Cada llamada a `query()` o `transaction()` inspecciona
 *    el ALS y, si hay un contexto activo, abre una transacción y emite las
 *    sentencias `SET LOCAL` necesarias ANTES de ejecutar la consulta real:
 *      - `SET LOCAL app.current_tenant_id = '<uuid>'`  → aísla filas por tenant
 *      - `SET LOCAL app.is_superadmin = 'true'`        → otorga acceso irrestricto
 *    Las políticas RLS de Postgres leen estas variables de sesión para decidir
 *    qué filas son visibles/modificables sin que el desarrollador deba escribir
 *    filtros WHERE manuales.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { RlsContext } from './rls-context.interface.js';

/** Opciones de configuración del pool de `pg`. */
const POOL_CONFIG = {
  /** Número máximo de clientes simultáneos en el pool. */
  max: 15,
  /** Tiempo (ms) que un cliente inactivo espera antes de ser cerrado. */
  idleTimeoutMillis: 30_000,
  /** Tiempo máximo (ms) para obtener un cliente del pool antes de lanzar error. */
  connectionTimeoutMillis: 3_000,
} as const;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);

  /** Pool de conexiones nativas con PostgreSQL. */
  private readonly pool: Pool;

  /**
   * AsyncLocalStorage que propaga el contexto de seguridad RLS (`RlsContext`)
   * a lo largo de toda la cadena asíncrona de una petición HTTP.
   *
   * El `TenantInterceptor` (u otro Guard/Middleware) es responsable de
   * inicializar este store mediante `als.run(context, callback)` antes de
   * que los handlers del controlador sean ejecutados.
   *
   * @example
   * // En un interceptor:
   * this.db.als.run({ tenantId: tenant.id }, () => next.handle());
   *
   * // En un guard de superadmin:
   * this.db.als.run({ isSuperAdmin: true }, () => next.handle());
   */
  public readonly als = new AsyncLocalStorage<RlsContext>();

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('La variable de entorno DATABASE_URL no está definida.');
    }

    this.pool = new Pool({ connectionString, ...POOL_CONFIG });

    // Capturamos errores de clientes en estado "idle" para evitar crashes silenciosos.
    this.pool.on('error', (err) => {
      this.logger.error('Error inesperado en un cliente idle del pool:', err);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CICLO DE VIDA DEL MÓDULO
  // ──────────────────────────────────────────────────────────────────────────

  /** Verifica la conexión a la base de datos al iniciar el módulo NestJS. */
  async onModuleInit(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      this.logger.log('✅ Conexión al pool de PostgreSQL establecida correctamente.');
    } finally {
      client.release();
    }
  }

  /** Cierra limpiamente el pool de conexiones al detener la aplicación. */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Pool de PostgreSQL cerrado.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Ejecuta una consulta SQL aplicando el contexto RLS activo automáticamente.
   *
   * **Flujo interno:**
   * 1. Lee el `RlsContext` del `AsyncLocalStorage`.
   * 2. Si hay contexto activo (`tenantId` o `isSuperAdmin`):
   *    - Adquiere un cliente dedicado del pool.
   *    - Abre una transacción (`BEGIN`).
   *    - Emite las sentencias `SET LOCAL` correspondientes.
   *    - Ejecuta la consulta del llamador.
   *    - Hace `COMMIT` y libera el cliente.
   * 3. Si NO hay contexto activo, ejecuta la consulta directamente en el pool
   *    (útil para operaciones del sistema: crear un tenant, health checks, etc.).
   *
   * @typeParam T - Tipo de cada fila del resultado. Por defecto es `any`.
   * @param text   - Sentencia SQL parametrizada. Ej: `'SELECT * FROM products WHERE id = $1'`
   * @param params - Valores para los placeholders `$N`. Ej: `[productId]`
   * @returns Promesa con el `QueryResult<T>` de `pg`.
   *
   * @example
   * // Dentro de un servicio NestJS inyectado:
   * const result = await this.db.query<ProductRow>(
   *   'SELECT id, title FROM products WHERE slug = $1',
   *   [slug],
   * );
   * return result.rows[0];
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
  ): Promise<QueryResult<T>> {
    const context = this.als.getStore();

    if (!this.hasRlsContext(context)) {
      // Sin contexto RLS: ejecutamos directo en el pool (sin transacción overhead).
      return this.pool.query<T>(text, params);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.applyRlsSettings(client, context!);
      const result = await client.query<T>(text, params);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ejecuta un bloque de operaciones SQL dentro de una única transacción,
   * con el contexto RLS aplicado automáticamente.
   *
   * Ideal para operaciones de escritura atómica que involucran múltiples
   * sentencias SQL (ej: crear un producto + sus variantes + su inventario).
   *
   * @typeParam T - Tipo del valor retornado por el callback.
   * @param callback - Función que recibe el `PoolClient` configurado con RLS
   *                   y retorna una promesa con el resultado final.
   * @returns Promesa con el valor retornado por `callback`.
   *
   * @example
   * const newProduct = await this.db.transaction(async (client) => {
   *   const { rows } = await client.query(
   *     'INSERT INTO products (id, title, ...) VALUES ($1, $2, ...) RETURNING *',
   *     [id, title, ...],
   *   );
   *   await client.query('INSERT INTO variants ...', [...]);
   *   return rows[0];
   * });
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const context = this.als.getStore();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (this.hasRlsContext(context)) {
        await this.applyRlsSettings(client, context!);
      }
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene los datos maestros de un tenant a partir de su slug.
   *
   * Esta consulta se ejecuta **sin filtro RLS** porque la tabla `tenants` no
   * tiene habilitado RLS (es una tabla de sistema global). Se utiliza
   * principalmente por el `TenantInterceptor` antes de que el contexto ALS
   * esté activo.
   *
   * @param slug - Identificador legible por humanos del tenant (ej: `"zapatos-martin"`).
   * @returns Los datos del tenant o `null` si no existe.
   */
  async getTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    const result = await this.pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants WHERE slug = $1',
      [slug],
    );
    return result.rows[0] ?? null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Determina si el contexto RLS requiere que se abra una transacción con
   * variables de sesión `SET LOCAL`.
   *
   * Retorna `true` si el contexto tiene al menos un campo activo (`tenantId`
   * con valor o `isSuperAdmin` en `true`).
   */
  private hasRlsContext(context: RlsContext | undefined): boolean {
    if (!context) return false;
    return !!(context.tenantId || context.isSuperAdmin);
  }

  /**
   * Emite las sentencias `SET LOCAL` necesarias sobre el cliente dado,
   * basándose en el `RlsContext` activo.
   *
   * **Importante:** Este método DEBE llamarse después de `BEGIN` y ANTES de
   * ejecutar la consulta real, ya que `SET LOCAL` solo tiene efecto dentro de
   * la transacción activa.
   *
   * Variables emitidas:
   * - `app.current_tenant_id` → usada por las políticas RLS para filtrar filas.
   * - `app.is_superadmin`     → usada por las políticas RLS para by-pass de acceso.
   *
   * @param client  - Cliente `pg` con una transacción activa.
   * @param context - Contexto RLS leído del `AsyncLocalStorage`.
   */
  private async applyRlsSettings(client: PoolClient, context: RlsContext): Promise<void> {
    if (context.tenantId) {
      // Parámetro posicional para prevenir SQL injection aunque sea un UUID.
      await client.query('SET LOCAL app.current_tenant_id = $1', [context.tenantId]);
    }

    if (context.isSuperAdmin === true) {
      // Usamos literal directo; el valor es booleano controlado por el código, no por el usuario.
      await client.query("SET LOCAL app.is_superadmin = 'true'");
    }
  }
}
