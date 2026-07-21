/**
 * @file create-coupon.dto.ts
 * @description DTO para crear un cupón de descuento.
 */

import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsEnum(DiscountType)
  discount_type: DiscountType;

  @IsNumber()
  @IsPositive()
  discount_value: number;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_until?: string | null;

  @IsInt()
  @IsPositive()
  @IsOptional()
  usage_limit?: number | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
