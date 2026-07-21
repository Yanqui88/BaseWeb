/**
 * @file admin/products-csv.service.ts
 * @description Servicio para importación y exportación masiva de productos via CSV.
 *
 * Hito 10 – Fase 4: Operativa B2B: Importador/Exportador masivo de productos vía CSV.
 * ─────────────────────────────────────────────────────────────────────────────
 * Schema real del proyecto:
 *   products  → id, tenant_id, title, slug, description, status, cover_image
 *   variants  → id, tenant_id, product_id, sku, title, price, compare_at
 *   inventory → id, tenant_id, product_variant_id, location_id, quantity
 *
 * IMPORTACIÓN:
 *   - Por cada fila CSV, crea/actualiza el producto y su variante principal (SKU).
 *   - Upsert basado en SKU de la variante (UNIQUE: tenant_id + sku en variants).
 *   - Si el producto ya existe (por SKU de variante), actualiza precio y stock.
 *   - Si es nuevo, inserta producto + variante principal.
 *   - El stock se actualiza en la primera ubicación activa del tenant (o sin ubicación).
 *   - Todo dentro de una única transacción SQL con contexto RLS activo (ALS).
 *
 * EXPORTACIÓN:
 *   - JOIN entre products y variants para obtener SKU, precio y stock total.
 *   - El RLS de Postgres filtra automáticamente por tenant.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { DbService } from '../db/db.service.js';

/** Campos esperados en cada fila del CSV de importación. */
export interface CsvProductRow {
  nombre: string;
  sku: string;
  precio: string;
  stock: string;
  descripcion?: string;
  estado?: string;
}

/** Resultado resumido de la operación de importación. */
export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; sku: string; reason: string }>;
}

@Injectable()
export class ProductsCsvService {
  private readonly logger = new Logger(ProductsCsvService.name);

  constructor(private readonly db: DbService) {}

  /**
   * Parsea el buffer de un archivo CSV y devuelve un array de filas.
   * Normaliza los nombres de columna a minúsculas y recorta espacios,
   * siendo tolerante a variaciones de encabezado (español/inglés).
   */
  private parseCsv(buffer: Buffer): Promise<CsvProductRow[]> {
    return new Promise((resolve, reject) => {
      const rows: CsvProductRow[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => header.trim().toLowerCase(),
          }),
        )
        .on('data', (row: Record<string, string>) => {
          const normalized: CsvProductRow = {
            nombre: (row['nombre'] ?? row['name'] ?? row['title'] ?? '').trim(),
            sku: (row['sku'] ?? '').trim().toUpperCase(),
            precio: (row['precio'] ?? row['price'] ?? '').trim(),
            stock: (row['stock'] ?? row['quantity'] ?? '0').trim(),
            descripcion: (row['descripcion'] ?? row['description'] ?? '').trim() || undefined,
            estado: (row['estado'] ?? row['status'] ?? '').trim() || undefined,
          };
          // Skip completely empty rows
          if (!normalized.nombre && !normalized.sku && !normalized.precio) return;
          rows.push(normalized);
        })
        .on('end', () => resolve(rows))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Valida una fila del CSV y devuelve los errores encontrados.
   */
  private validateRow(row: CsvProductRow, index: number): string[] {
    const errors: string[] = [];

    if (!row.nombre || row.nombre.length === 0) {
      errors.push(`El campo 'nombre' es obligatorio.`);
    }
    if (row.nombre && row.nombre.length > 255) {
      errors.push(`El campo 'nombre' no puede superar 255 caracteres.`);
    }
    if (!row.sku || row.sku.length === 0) {
      errors.push(`El campo 'sku' es obligatorio.`);
    }
    if (row.sku && row.sku.length > 255) {
      errors.push(`El campo 'sku' no puede superar 255 caracteres.`);
    }
    if (!row.precio || isNaN(parseFloat(row.precio))) {
      errors.push(`El campo 'precio' debe ser un número válido (recibido: '${row.precio}').`);
    } else if (parseFloat(row.precio) < 0) {
      errors.push(`El campo 'precio' no puede ser negativo.`);
    }
    if (row.stock && isNaN(parseInt(row.stock, 10))) {
      errors.push(`El campo 'stock' debe ser un número entero.`);
    }

    const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED', 'draft', 'active', 'archived'];
    if (row.estado && !validStatuses.includes(row.estado)) {
      errors.push(`Estado inválido '${row.estado}'. Válidos: DRAFT, ACTIVE, ARCHIVED.`);
    }

    // Log la fila fallida para diagnóstico
    if (errors.length > 0) {
      this.logger.warn(`[CSV Validation] Fila ${index + 1} (SKU: ${row.sku || '-'}): ${errors.join(' | ')}`);
    }

    return errors;
  }

  /**
   * Genera un slug único a partir del nombre y el SKU.
   * Elimina acentos, reemplaza espacios con guiones y normaliza.
   */
  private generateSlug(nombre: string, sku: string): string {
    const nameSlug = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const skuSlug = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${nameSlug}-${skuSlug}`;
  }

  /** Normaliza el estado CSV al enum ProductStatus de Postgres. */
  private normalizeStatus(estado?: string): 'DRAFT' | 'ACTIVE' | 'ARCHIVED' {
    if (!estado) return 'DRAFT';
    const upper = estado.toUpperCase();
    if (upper === 'ACTIVE' || upper === 'ARCHIVED' || upper === 'DRAFT') return upper;
    return 'DRAFT';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IMPORTACIÓN
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Importa masivamente productos desde un archivo CSV.
   *
   * Por cada fila válida del CSV:
   *  1. Busca si ya existe una variante con ese SKU para el tenant.
   *  2. Si NO existe: inserta producto nuevo + variante principal.
   *  3. Si SÍ existe: actualiza precio en variante y título/descripción en producto.
   *  4. Ajusta el stock en inventory (upsert por variant_id + location_id).
   *     Usa la primera ubicación activa del tenant o NULL si no hay ubicaciones.
   *
   * Todo dentro de una única transacción SQL con el contexto RLS activo vía ALS.
   *
   * @param buffer   - Buffer del archivo CSV (recibido desde multer memoryStorage).
   * @param tenantId - UUID del tenant activo (obtenido del ALS).
   */
  async importFromCsv(buffer: Buffer, tenantId: string): Promise<ImportResult> {
    const rows = await this.parseCsv(buffer);

    if (rows.length === 0) {
      throw new BadRequestException('El archivo CSV está vacío o no tiene filas de datos.');
    }

    const result: ImportResult = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Validar todas las filas antes de iniciar la transacción
    const validRows: Array<{ row: CsvProductRow; index: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const validationErrors = this.validateRow(rows[i], i);
      if (validationErrors.length > 0) {
        result.skipped++;
        result.errors.push({
          row: i + 1,
          sku: rows[i].sku || '-',
          reason: validationErrors.join(' | '),
        });
      } else {
        validRows.push({ row: rows[i], index: i });
      }
    }

    if (validRows.length === 0) {
      this.logger.warn(`[Import CSV] Todas las filas fallaron validación. TenantId: ${tenantId}`);
      return result;
    }

    // Ejecutar Upsert dentro de una única transacción con RLS activo
    await this.db.transaction(async (client) => {
      // Obtener la primera ubicación activa del tenant para el stock
      const locationResult = await client.query<{ id: string }>(
        `SELECT id FROM locations WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
        [tenantId],
      );
      const locationId: string | null = locationResult.rows[0]?.id ?? null;

      for (const { row } of validRows) {
        const price = Math.round(parseFloat(row.precio)); // price es INTEGER en el schema
        const stock = parseInt(row.stock || '0', 10);
        const status = this.normalizeStatus(row.estado);
        const slug = this.generateSlug(row.nombre, row.sku);
        const descripcion = row.descripcion ?? null;

        // 1. Buscar si ya existe una variante con este SKU para el tenant
        const existingVariant = await client.query<{ id: string; product_id: string }>(
          `SELECT id, product_id FROM variants WHERE tenant_id = $1 AND sku = $2 LIMIT 1`,
          [tenantId, row.sku],
        );

        let variantId: string;

        if (existingVariant.rows.length === 0) {
          // ── CASO: INSERCIÓN NUEVA ──────────────────────────────────────────
          // 2a. Insertar el producto
          const slugUnique = `${slug}-${Date.now()}`;
          const productResult = await client.query<{ id: string }>(
            `INSERT INTO products (id, tenant_id, title, slug, description, status)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"ProductStatus")
             RETURNING id`,
            [tenantId, row.nombre, slugUnique, descripcion, status],
          );
          const productId = productResult.rows[0].id;

          // 2b. Insertar la variante principal
          const variantResult = await client.query<{ id: string }>(
            `INSERT INTO variants (id, tenant_id, product_id, sku, title, price)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
             RETURNING id`,
            [tenantId, productId, row.sku, row.nombre, price],
          );
          variantId = variantResult.rows[0].id;

          result.inserted++;
        } else {
          // ── CASO: ACTUALIZACIÓN ───────────────────────────────────────────
          const existing = existingVariant.rows[0];
          variantId = existing.id;

          // 3a. Actualizar precio en la variante
          await client.query(
            `UPDATE variants SET price = $1, updated_at = NOW() WHERE id = $2`,
            [price, variantId],
          );

          // 3b. Actualizar datos del producto (título, descripción, estado)
          await client.query(
            `UPDATE products SET title = $1, description = $2, status = $3::"ProductStatus", updated_at = NOW() WHERE id = $4`,
            [row.nombre, descripcion, status, existing.product_id],
          );

          result.updated++;
        }

        // 4. Actualizar stock en inventory (Upsert por variant + location)
        if (locationId) {
          await client.query(
            `INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)
             ON CONFLICT (product_variant_id, location_id)
             DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
            [tenantId, variantId, locationId, stock],
          );
        }
      }
    });

    this.logger.log(
      `[Import CSV] TenantId: ${tenantId} | Total: ${result.total} | Inserted: ${result.inserted} | Updated: ${result.updated} | Skipped: ${result.skipped}`,
    );

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORTACIÓN
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Exporta todos los productos del tenant activo como string CSV.
   *
   * Hace JOIN con variants para obtener SKU y precio, y con inventory
   * para calcular el stock total sumando todas las ubicaciones.
   *
   * El RLS de Postgres filtra automáticamente al tenant correcto.
   *
   * @returns Promesa con el contenido CSV como string UTF-8.
   */
  async exportToCsv(): Promise<string> {
    const result = await this.db.query<{
      nombre: string;
      sku: string;
      precio: number | null;
      stock: number;
      descripcion: string | null;
      estado: string;
    }>(
      `SELECT
         p.title         AS nombre,
         v.sku           AS sku,
         v.price         AS precio,
         COALESCE(SUM(i.quantity), 0)::int AS stock,
         p.description   AS descripcion,
         p.status::text  AS estado
       FROM products p
       LEFT JOIN variants v ON v.product_id = p.id AND v.tenant_id = p.tenant_id
       LEFT JOIN inventory i ON i.product_variant_id = v.id
       GROUP BY p.id, p.title, p.description, p.status, v.sku, v.price
       ORDER BY p.created_at DESC, v.sku ASC`,
    );

    const headers = ['nombre', 'sku', 'precio', 'stock', 'descripcion', 'estado'];
    const rows = result.rows.map((p) => [
      this.escapeCsvField(p.nombre),
      this.escapeCsvField(p.sku ?? ''),
      String(p.precio ?? 0),
      String(p.stock ?? 0),
      this.escapeCsvField(p.descripcion ?? ''),
      this.escapeCsvField(p.estado),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\r\n');

    return csvContent;
  }

  /**
   * Escapa un campo CSV. Si contiene comas, comillas o saltos de línea,
   * lo envuelve en comillas dobles y duplica las comillas internas.
   */
  private escapeCsvField(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
