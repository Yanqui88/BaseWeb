'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export interface Coupon {
  id: string;
  tenant_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const getHeaders = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const tenantDomain = host.split(':')[0];

  const headersObj: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-domain': tenantDomain,
  };

  if (token) {
    headersObj['Authorization'] = `Bearer ${token}`;
  }

  return headersObj;
};

const getTenantSlug = () => {
  return process.env.NEXT_PUBLIC_TENANT_SLUG || 'default';
};

export async function fetchCoupons(page: number = 1): Promise<{ success: boolean; data: Coupon[]; total: number }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/coupons?page=${page}&limit=20`, {
      headers: headersObj,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch coupons: ${res.statusText}`);
    }

    const json = await res.json();
    return {
      success: true,
      data: json.data || [],
      total: json.total || 0,
    };
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return { success: false, data: [], total: 0 };
  }
}

export async function createCouponAction(data: {
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  valid_from?: string;
  valid_until?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
}): Promise<{ success: boolean; data?: Coupon; error?: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/coupons`, {
      method: 'POST',
      headers: headersObj,
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || `Failed to create coupon: ${res.statusText}`);
    }

    revalidatePath('/coupons');
    return { success: true, data: json.data };
  } catch (error: any) {
    console.error('Error creating coupon:', error);
    return { success: false, error: error.message || 'Error al crear el cupón' };
  }
}

export async function deactivateCouponAction(id: string): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/coupons/${id}`, {
      method: 'DELETE',
      headers: headersObj,
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || `Failed to deactivate coupon: ${res.statusText}`);
    }

    revalidatePath('/coupons');
    return { success: true };
  } catch (error: any) {
    console.error('Error deactivating coupon:', error);
    return { success: false, error: error.message || 'Error al desactivar el cupón' };
  }
}
