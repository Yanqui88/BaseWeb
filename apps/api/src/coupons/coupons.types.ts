/**
 * @file coupons.types.ts
 * @description Tipos TypeScript compartidos por el módulo de cupones.
 */

export interface CouponRow {
  id: string;
  tenant_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: string; // pg devuelve NUMERIC como string
  valid_from: Date;
  valid_until: Date | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ValidateCouponResult {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
}
