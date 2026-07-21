import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Dirección de envío. */
export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  zip_code!: string;

  @IsString()
  @IsOptional()
  country?: string;
}

/** Ítem individual dentro de una orden. */
export class CreateOrderItemDto {
  /** UUID del producto comprado. */
  @IsUUID('4', { message: 'productId debe ser un UUID v4 válido.' })
  @IsNotEmpty()
  productId!: string;

  /** UUID de la variante (si aplica). Null si el producto no tiene variantes. */
  @IsUUID('4', { message: 'variantId debe ser un UUID v4 válido.' })
  @IsOptional()
  variantId?: string | null;

  /** Cantidad de unidades compradas. Debe ser >= 1. */
  @IsInt({ message: 'quantity debe ser un número entero.' })
  @Min(1, { message: 'quantity debe ser al menos 1.' })
  quantity!: number;

  /** Precio unitario congelado al momento de la compra (en ARS). */
  @IsNumber({}, { message: 'unitPrice debe ser un número.' })
  @IsPositive({ message: 'unitPrice debe ser mayor a 0.' })
  unitPrice!: number;
}

export enum ShippingMethodEnum {
  PICKUP = 'pickup',
  ANDREANI_STANDARD = 'andreani_standard',
  ANDREANI_EXPRESS = 'andreani_express',
  MOTO_LOCAL = 'moto_local',
}

/** DTO principal para la creación de una orden completa (Guest Checkout). */
export class CreateOrderDto {
  /** UUID de la sucursal/depósito que procesa y despacha esta orden. */
  @IsUUID('4', { message: 'locationId debe ser un UUID v4 válido.' })
  @IsNotEmpty()
  locationId!: string;

  // ── Datos del comprador ────────────────────────────────────────────────────
  @IsEmail({}, { message: 'customerEmail debe ser un email válido.' })
  @IsNotEmpty()
  customerEmail!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerDocument?: string; // DNI / CUIT

  // ── Mercado Pago ──────────────────────────────────────────────────────────
  /** ID de preferencia de Mercado Pago para cruzar con el Webhook de pago. */
  @IsString()
  @IsOptional()
  mpTransactionId?: string;

  // ── Logística y envío ─────────────────────────────────────────────────────
  /** Método de envío seleccionado por el comprador en el checkout. */
  @IsEnum(ShippingMethodEnum)
  @IsOptional()
  shippingMethod?: ShippingMethodEnum;

  /** Dirección de entrega (requerida si shippingMethod !== 'pickup'). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  // ── Importes ──────────────────────────────────────────────────────────────
  /** Subtotal sin envío (suma de unit_price * quantity de cada ítem). */
  @IsNumber()
  @Min(0)
  subtotal!: number;

  /** Costo de envío cotizado (0 si es pickup). */
  @IsNumber()
  @Min(0)
  shippingCost!: number;

  /** Total final = subtotal + shippingCost. */
  @IsNumber()
  @IsPositive()
  total!: number;

  // ── Ítems ─────────────────────────────────────────────────────────────────
  /** Lista de productos/variantes comprados con precios congelados. */
  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe tener al menos un ítem.' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

