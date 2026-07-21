/**
 * @file update-coupon.dto.ts
 * @description DTO para actualizar parcialmente un cupón.
 * Todos los campos son opcionales (PATCH semántico).
 */

import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { DiscountType } from './create-coupon.dto.js';

export class UpdateCouponDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  code?: string;

  @IsEnum(DiscountType)
  @IsOptional()
  discount_type?: DiscountType;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  discount_value?: number;

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
