'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

// ──────────────────────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────────────────────

export interface BillingStatus {
  status: 'trial' | 'active' | 'grace_period' | 'suspended' | 'deleted' | 'unknown';
  trial_ends_at: string | null;
  updated_at: string | null;
  days_remaining: number | null;
}

export interface CreatePreferenceResult {
  preferenceId: string;
  initPoint: string;
}

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye los headers comunes para las llamadas al backend:
 *   - Authorization: Bearer <jwt>
 *   - Content-Type: application/json
 *   - x-tenant-domain: <host>
 */
const getAuthHeaders = async (): Promise<Record<string, string>> => {
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

// ──────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el estado actual del billing del tenant autenticado.
 *
 * @returns `{ success, data? }` con BillingStatus.
 */
export async function getBillingStatusAction(): Promise<{
  success: boolean;
  data?: BillingStatus;
  error?: string;
}> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getAuthHeaders();

  try {
    const res = await fetch(`${apiUrl}/saas/billing/status`, {
      method: 'GET',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text };
    }

    const data: BillingStatus = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('[getBillingStatusAction] Error:', error);
    return { success: false, error: 'No se pudo conectar con el servidor.' };
  }
}

/**
 * Server Action: Crea una preferencia de Checkout Pro en Mercado Pago y
 * redirige al usuario a la URL de pago (init_point).
 *
 * Uso en el componente:
 *   <form action={createPreferenceAndRedirectAction}>
 *     <button type="submit">Renovar Suscripción</button>
 *   </form>
 *
 * La redirección ocurre en el servidor (redirect() de next/navigation).
 */
export async function createPreferenceAndRedirectAction(): Promise<never> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getAuthHeaders();

  let initPoint: string;

  try {
    const res = await fetch(`${apiUrl}/saas/billing/create-preference`, {
      method: 'POST',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[createPreferenceAndRedirectAction] Error MP:', text);
      // Redirigir con error visible al usuario
      redirect('/settings/billing?status=error');
    }

    const data: CreatePreferenceResult = await res.json();
    initPoint = data.initPoint;
  } catch (error) {
    console.error('[createPreferenceAndRedirectAction] Excepción:', error);
    redirect('/settings/billing?status=error');
  }

  // Redirigir al checkout de Mercado Pago
  redirect(initPoint);
}
