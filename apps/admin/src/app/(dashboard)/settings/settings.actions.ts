'use server';

import { cookies, headers } from 'next/headers';

export interface TenantSeoData {
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoOgImage: string | null;
}

export interface TenantConfigData {
  id: string;
  name: string;
  domain: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  whatsapp_phone: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_og_image: string | null;
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

export async function getTenantConfigAction(): Promise<{ success: boolean; data?: TenantConfigData }> {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'default';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/tenant/config`, {
      method: 'GET',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch tenant config: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return { success: false };
  }
}

export interface TenantVisualData {
  name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  whatsapp_phone?: string | null;
}

export async function updateTenantVisualAction(data: TenantVisualData): Promise<{ success: boolean; data?: any }> {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'default';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/tenant/visual`, {
      method: 'PUT',
      headers: headersObj,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update tenant visual config: ${res.statusText}`);
    }

    const responseData = await res.json();
    return { success: true, data: responseData };
  } catch (error) {
    console.error('Error updating tenant visual config:', error);
    return { success: false };
  }
}

export async function updateTenantSeoAction(data: TenantSeoData): Promise<{ success: boolean; data?: any }> {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'default';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/tenant/seo`, {
      method: 'PUT',
      headers: headersObj,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update tenant SEO: ${res.statusText}`);
    }

    const responseData = await res.json();
    return { success: true, data: responseData };
  } catch (error) {
    console.error('Error updating tenant SEO:', error);
    return { success: false };
  }
}
