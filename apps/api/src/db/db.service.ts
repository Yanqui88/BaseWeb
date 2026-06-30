import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  
  // AsyncLocalStorage nos permite guardar información del contexto de la petición actual (el tenantId)
  // de forma asíncrona, similar a cómo funciona ThreadLocal en Java.
  public readonly als = new AsyncLocalStorage<{ tenantId: string }>();

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 15, // Número máximo de conexiones simultáneas por este proceso
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async onModuleInit() {
    // Probamos la conexión al arrancar el servidor NestJS
    const client = await this.pool.connect();
    client.release();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Ejecuta una consulta SQL pura en la base de datos aplicando la seguridad RLS
   * de forma automática si hay un tenantId activo en el contexto actual.
   * 
   * @param text La consulta SQL. Ejemplo: 'SELECT * FROM products WHERE id = $1'
   * @param params Parámetros ordenados. Ejemplo: [productId]
   */
  async query<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
    const store = this.als.getStore();
    const tenantId = store?.tenantId;

    // Si no hay un tenantId en el contexto, ejecutamos de forma normal sin RLS.
    // Esto es útil para procesos del sistema globales (ej: crear un nuevo tenant).
    if (!tenantId) {
      return this.pool.query<T>(text, params);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Establecemos la variable de sesión LOCAL que Postgres RLS usará para filtrar
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
      const result = await client.query<T>(text, params);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Devolvemos la conexión al pool
      client.release();
    }
  }

  /**
   * Ejecuta un callback con un cliente dedicado en una sola transacción SQL
   * configurada con el tenantId para RLS. Útil para operaciones complejas de escritura.
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const store = this.als.getStore();
    const tenantId = store?.tenantId;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (tenantId) {
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
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
   * Obtiene la información maestra de un tenant usando el slug (sin filtro RLS).
   * Dado que la tabla 'tenants' no tiene RLS, esta consulta puede accederse libremente.
   */
  async getTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    const res = await this.pool.query(
      'SELECT id, name FROM tenants WHERE slug = $1',
      [slug]
    );
    return res.rows[0] || null;
  }
}
