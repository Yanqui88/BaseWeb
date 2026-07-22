'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Por favor completa todos los campos' };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  
  // Extraer el dominio del tenant para enviarlo (aunque para /auth/login el backend usa el email para identificar al tenant, es buena práctica si hay RLS)
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const tenantDomain = host.split(':')[0];

  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-domain': tenantDomain,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { error: 'Credenciales inválidas' };
      }
      return { error: 'Error de servidor. Intenta de nuevo.' };
    }

    const data = await res.json();
    
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'access_token',
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
    });

  } catch (err) {
    console.error('Error logging in:', err);
    return { error: 'Error de red' };
  }

  redirect('/');
}
