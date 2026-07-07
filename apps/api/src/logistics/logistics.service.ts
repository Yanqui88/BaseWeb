/**
 * @file logistics.service.ts
 * @description Servicio orquestador de logística para el tenant activo.
 *
 * **Responsabilidades:**
 * - Obtener el depósito de origen del tenant desde la base de datos.
 * - Calcular el peso total y volumen total del paquete a partir de los productos recibidos.
 * - Delegar la cotización real al `AndreaniService`.
 * - Retornar las opciones de tarifa al controlador.
 *
 * **Flujo de `quoteShipping`:**
 * 1. Lee el `tenantId` desde el `AsyncLocalStorage` (inyectado por el interceptor).
 * 2. Consulta `locations` para obtener el `zip_code` del depósito activo del tenant.
 *    El RLS filtra automáticamente por tenant.
 * 3. Acumula el peso y volumen de todos los productos recibidos en el DTO.
 * 4. Llama a `AndreaniService.quoteShipping()` con los parámetros calculados.
 * 5. Retorna el resultado al controlador.
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { AndreaniService, type AndreaniQuoteResult } from './providers/andreani.service.js';
import type { QuoteShippingDto } from './dto/quote-shipping.dto.js';

/** Fila de ubicación/depósito del tenant retornada por la DB. */
interface LocationRow {
  zip_code: string;
}

/** Respuesta del endpoint `POST /logistics/quote`. */
export interface ShippingQuoteResponse {
  /** Código postal de origen usado para la cotización. */
  originZip: string;
  /** Código postal de destino recibido del cliente. */
  destinationZip: string;
  /** Peso total calculado del paquete en gramos. */
  totalWeightGrams: number;
  /** Volumen total calculado del paquete en cm³. */
  totalVolumeCm3: number;
  /** Opciones de envío disponibles con sus tarifas y plazos. */
  opciones: AndreaniQuoteResult['opciones'];
}

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly db: DbService,
    private readonly andreaniService: AndreaniService,
  ) {}

  /**
   * Cotiza las opciones de envío para un pedido del tenant activo.
   *
   * @param dto - Datos del destino y los productos del pedido.
   * @returns Las opciones de envío disponibles con tarifas y plazos.
   * @throws InternalServerErrorException si el contexto RLS no está activo.
   * @throws NotFoundException si el tenant no tiene un depósito configurado.
   */
  async quoteShipping(dto: QuoteShippingDto): Promise<ShippingQuoteResponse> {
    const tenantId = this.db.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'El contexto RLS no está activo. Asegúrate de que el interceptor de tenant esté configurado.',
      );
    }

    // ── 1. Obtener el zip_code del depósito activo del tenant ─────────────────
    const locationResult = await this.db.query<LocationRow>(
      'SELECT zip_code FROM locations LIMIT 1',
    );

    if (locationResult.rows.length === 0) {
      throw new NotFoundException(
        `El tenant ${tenantId} no tiene ningún depósito/ubicación configurado.`,
      );
    }

    const originZip = locationResult.rows[0].zip_code;
    this.logger.log(
      `[Tenant: ${tenantId}] Depósito origen: CP ${originZip}. Destino: CP ${dto.destinationZip}.`,
    );

    // ── 2. Calcular peso total y volumen total del paquete ────────────────────
    let totalWeightGrams = 0;
    let totalVolumeCm3 = 0;

    for (const product of dto.products) {
      const productVolume = product.heightCm * product.widthCm * product.depthCm;
      totalWeightGrams += product.weightGrams * product.quantity;
      totalVolumeCm3 += productVolume * product.quantity;
    }

    this.logger.log(
      `[Tenant: ${tenantId}] Paquete calculado: ${totalWeightGrams}g | ${totalVolumeCm3}cm³`,
    );

    // ── 3. Delegar la cotización al AndreaniService ───────────────────────────
    const quoteResult = await this.andreaniService.quoteShipping(
      originZip,
      dto.destinationZip,
      totalWeightGrams,
      totalVolumeCm3,
    );

    return {
      originZip,
      destinationZip: dto.destinationZip,
      totalWeightGrams,
      totalVolumeCm3,
      opciones: quoteResult.opciones,
    };
  }
}
