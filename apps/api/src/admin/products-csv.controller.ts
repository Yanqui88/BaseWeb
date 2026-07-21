/**
 * @file admin/products-csv.controller.ts
 * @description Controlador NestJS para los endpoints de importación/exportación CSV de productos.
 *
 * Hito 10 – Fase 4: Operativa B2B.
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   POST /:tenantSlug/products/import — Recibe archivo CSV y dispara importación masiva.
 *   GET  /:tenantSlug/products/export — Devuelve un archivo .csv con todos los productos.
 *
 * Seguridad:
 *   - El contexto RLS ya está activo en el ALS cuando llega al controlador
 *     (activado por TenantInterceptor en cada request HTTP).
 *   - No se necesitan filtros WHERE manuales; Postgres filtra por tenant automáticamente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Response } from 'express';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsCsvService } from './products-csv.service.js';
import { DbService } from '../db/db.service.js';

@Controller('admin')
export class ProductsCsvController {
  constructor(
    private readonly csvService: ProductsCsvService,
    private readonly db: DbService,
  ) {}

  /**
   * POST /:tenantSlug/products/import
   *
   * Recibe un archivo CSV (campo `file`) con columnas:
   *   nombre, sku, precio, stock, descripcion (opcional), estado (opcional)
   *
   * Devuelve un JSON con el resumen de la operación:
   *   { total, inserted, updated, skipped, errors[] }
   *
   * El archivo se procesa en memoria (memoryStorage de multer) para evitar
   * escribir temporales al disco innecesariamente.
   */
  @Post(':tenantSlug/products/import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB máximo
      },
      fileFilter: (_req, file, cb) => {
        const allowed = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];
        // Algunos clientes envían CSV como text/plain o application/octet-stream
        const isAllowed =
          allowed.includes(file.mimetype) ||
          file.originalname.toLowerCase().endsWith('.csv');

        if (!isAllowed) {
          return cb(new BadRequestException('Solo se permiten archivos CSV.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async importCsv(
    @Param('tenantSlug') _tenantSlug: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo CSV.');
    }

    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Contexto de tenant requerido.');
    }

    const result = await this.csvService.importFromCsv(file.buffer, tenantId);

    return {
      ok: true,
      message: `Importación completada. ${result.inserted} insertados, ${result.updated} actualizados, ${result.skipped} omitidos.`,
      ...result,
    };
  }

  /**
   * GET /:tenantSlug/products/export
   *
   * Genera y descarga un archivo CSV con todos los productos del tenant.
   * El RLS de Postgres garantiza que solo se devuelven productos del tenant activo.
   *
   * La respuesta usa el header Content-Disposition para forzar la descarga
   * del archivo en el navegador.
   */
  @Get(':tenantSlug/products/export')
  async exportCsv(
    @Param('tenantSlug') tenantSlug: string,
    @Res() res: Response,
  ): Promise<void> {
    const csvContent = await this.csvService.exportToCsv();

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `productos-${tenantSlug}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM UTF-8 para que Excel lo abra correctamente
    res.send('\uFEFF' + csvContent);
  }
}
