import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class UpsertBannerDto {
  @IsString()
  @IsNotEmpty()
  desktopImageUrl!: string;

  @IsString()
  @IsNotEmpty()
  mobileImageUrl!: string;

  @IsString()
  @IsOptional()
  href?: string | null;

  @IsString()
  @IsOptional()
  alt?: string | null;

  @IsString()
  @IsOptional()
  badge?: string | null;

  @IsString()
  @IsOptional()
  title?: string | null;

  @IsString()
  @IsOptional()
  subtitle?: string | null;

  @IsString()
  @IsOptional()
  buttonText?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTenantSeoDto {
  @IsString()
  @IsOptional()
  seoTitle?: string | null;

  @IsString()
  @IsOptional()
  seoDescription?: string | null;

  @IsString()
  @IsOptional()
  seoKeywords?: string | null;

  @IsString()
  @IsOptional()
  seoOgImage?: string | null;
}

export enum ProductStatusEnum {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsEnum(ProductStatusEnum)
  @IsOptional()
  status?: ProductStatusEnum;

  @IsString()
  @IsOptional()
  coverImage?: string | null;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsEnum(ProductStatusEnum)
  @IsOptional()
  status?: ProductStatusEnum;

  @IsString()
  @IsOptional()
  coverImage?: string | null;
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsString()
  @IsOptional()
  title?: string | null;

  @IsNumber()
  @IsOptional()
  compareAt?: number | null;
}

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  title?: string | null;

  @IsNumber()
  @IsOptional()
  compareAt?: number | null;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  city?: string | null;

  @IsString()
  @IsOptional()
  address?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  city?: string | null;

  @IsString()
  @IsOptional()
  address?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SetInventoryDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}
