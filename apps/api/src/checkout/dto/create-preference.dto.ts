/**
 * @file create-preference.dto.ts
 * @description DTO para la creación de preferencias de pago en Mercado Pago.
 */

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CheckoutItemDto {
  @IsString({ message: 'title debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'title no puede estar vacío.' })
  title!: string;

  @IsNumber({}, { message: 'quantity debe ser un número.' })
  @IsPositive({ message: 'quantity debe ser mayor a 0.' })
  quantity!: number;

  @IsNumber({}, { message: 'unit_price debe ser un número.' })
  @IsPositive({ message: 'unit_price debe ser mayor a 0.' })
  unit_price!: number;
}

export type CheckoutItem = CheckoutItemDto;

export class CheckoutCustomerDto {
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido.' })
  @IsNotEmpty({ message: 'email no puede estar vacío.' })
  email!: string;
}

export type CheckoutCustomer = CheckoutCustomerDto;


export class CreatePreferenceDto {
  @IsArray({ message: 'items debe ser un array.' })
  @ArrayMinSize(1, { message: 'items debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer!: CheckoutCustomerDto;
}
