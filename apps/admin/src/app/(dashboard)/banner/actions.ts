'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';

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

  if (token) headersObj['Authorization'] = `Bearer ${token}`;
  return headersObj;
};

const getTenantSlug = async (): Promise<string> => {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return 'demo';

  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.tenant?.slug) return data.tenant.slug;
    }
  } catch (err) {}
  return 'demo';
};

export async function getBannerAction() {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const slug = await getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${slug}/home/banner`, {
      headers: headersObj,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch banner');
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function updateBannerAction(data: any) {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const slug = await getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${slug}/home/banner`, {
      method: 'PUT',
      headers: headersObj,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update banner');
    
    revalidatePath('/banner');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUploadsAction() {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const slug = await getTenantSlug();
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${slug}/uploads`, {
      headers: headersObj,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch uploads');
    return await res.json();
  } catch (error) {
    return [];
  }
}

export async function uploadFileAction(formData: FormData) {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const slug = await getTenantSlug();
  
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const tenantDomain = host.split(':')[0];

  const headersObj: Record<string, string> = {
    'x-tenant-domain': tenantDomain,
  };
  if (token) headersObj['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${apiUrl}/admin/${slug}/uploads`, {
      method: 'POST',
      headers: headersObj,
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload file');
    const json = await res.json();
    return { success: true, url: json.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
