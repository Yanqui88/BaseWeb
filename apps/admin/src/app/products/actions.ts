'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies, headers } from 'next/headers';

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

/**
 * Devuelve los headers base SIN Content-Type para peticiones multipart/form-data.
 * (Dejamos que el browser/fetch maneje el boundary automáticamente.)
 */
const getMultipartHeaders = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const tenantDomain = host.split(':')[0];

  const headersObj: Record<string, string> = {
    'x-tenant-domain': tenantDomain,
  };

  if (token) {
    headersObj['Authorization'] = `Bearer ${token}`;
  }

  return headersObj;
};

/**
 * Server Action para actualizar un producto.
 * Realiza la mutación en la API NestJS y revalida la caché del panel y del catálogo.
 */
export async function updateProductAction(productId: string, data: any): Promise<{ success: boolean; data?: any }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/products/${productId}`, {
      method: 'PUT',
      headers: headersObj,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update product: ${res.statusText}`);
    }

    const result = await res.json();

    // Revalidación local en Next.js
    revalidatePath('/products');
    revalidateTag('products', 'max');

    return { success: true, data: result };
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    return { success: false };
  }
}

/**
 * Server Action para crear un nuevo producto.
 */
export async function createProductAction(data: any): Promise<{ success: boolean; data?: any }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/products`, {
      method: 'POST',
      headers: headersObj,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to create product: ${res.statusText}`);
    }

    const result = await res.json();

    // Revalidación local en Next.js
    revalidatePath('/products');
    revalidateTag('products', 'max');

    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating product:', error);
    return { success: false };
  }
}

/**
 * Server Action para importar productos desde un CSV.
 * Envía el archivo como FormData al endpoint POST /admin/{slug}/products/import.
 *
 * @param formData - FormData con el campo 'file' conteniendo el CSV.
 */
export async function importProductsCsvAction(
  formData: FormData,
  tenantSlug: string,
): Promise<{
  success: boolean;
  message?: string;
  total?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ row: number; sku: string; reason: string }>;
}> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getMultipartHeaders();

  try {
    const res = await fetch(`${apiUrl}/admin/${tenantSlug}/products/import`, {
      method: 'POST',
      headers: headersObj,
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data?.message || 'Error al importar el CSV.' };
    }

    // Revalidar catálogo tras importación masiva
    revalidatePath('/products');
    revalidateTag('products', 'max');

    return {
      success: true,
      message: data.message,
      total: data.total,
      inserted: data.inserted,
      updated: data.updated,
      skipped: data.skipped,
      errors: data.errors,
    };
  } catch (error) {
    console.error('Error importing CSV:', error);
    return { success: false, message: 'Error de conexión con el servidor.' };
  }
}
