/**
 * @file quote-shipping.dto.ts
 * @description DTOs para el endpoint `POST /logistics/quote`.
 *
 * Valida el cuerpo de la petición usando `class-validator`.
 * El controlador usa `ValidationPipe` global (o local) para aplicar estas reglas
 * automáticamente antes de invocar el método del servicio.
 */

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Representa un producto individual en el pedido, con las dimensiones físicas
 * necesarias para calcular el volumen y peso del paquete total.
 */
export class ProductDimensionsDto {
  /** Peso del producto en gramos. Ej: 500 = medio kilo. */
  @IsInt({ message: 'weightGrams debe ser un número entero.' })
  @IsPositive({ message: 'weightGrams debe ser mayor a 0.' })
  weightGrams!: number;

  /** Alto del producto en centímetros. */
  @IsInt({ message: 'heightCm debe ser un número entero.' })
  @IsPositive({ message: 'heightCm debe ser mayor a 0.' })
  heightCm!: number;

  /** Ancho del producto en centímetros. */
  @IsInt({ message: 'widthCm debe ser un número entero.' })
  @IsPositive({ message: 'widthCm debe ser mayor a 0.' })
  widthCm!: number;

  /** Largo/profundidad del producto en centímetros. */
  @IsInt({ message: 'depthCm debe ser un número entero.' })
  @IsPositive({ message: 'depthCm debe ser mayor a 0.' })
  depthCm!: number;

  /** Cantidad de unidades de este producto. Mínimo 1. */
  @IsInt({ message: 'quantity debe ser un número entero.' })
  @Min(1, { message: 'quantity debe ser al menos 1.' })
  quantity!: number;
}

/** Cuerpo esperado en `POST /logistics/quote`. */
export class QuoteShippingDto {
  /**
   * Código postal del domicilio de entrega del comprador.
   * Debe ser una cadena no vacía (Andreani acepta CP de 4 dígitos argentinos).
   */
  @IsString({ message: 'destinationZip debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'destinationZip no puede estar vacío.' })
  destinationZip!: string;

  /**
   * Lista de productos a incluir en el paquete a cotizar.
   * Debe contener al menos un ítem.
   */
  @IsArray({ message: 'products debe ser un array.' })
  @ArrayMinSize(1, { message: 'products debe tener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => ProductDimensionsDto)
  products!: ProductDimensionsDto[];
}
