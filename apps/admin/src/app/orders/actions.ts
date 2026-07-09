'use server';

import { cookies, headers } from 'next/headers';
import { Order, OrderDetail } from 'shared';

const getHeaders = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  // Remove port if present
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

export async function fetchOrders(page: number = 1): Promise<Order[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/orders?page=${page}&limit=20`, {
      headers: headersObj,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch orders: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/orders/${id}`, {
      headers: headersObj,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch order details: ${res.statusText}`);
    }

    const json = await res.json();
    return json.data || null;
  } catch (error) {
    console.error(`Error fetching order detail for id ${id}:`, error);
    return null;
  }
}
