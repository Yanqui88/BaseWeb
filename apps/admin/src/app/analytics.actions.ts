'use server';

import { cookies, headers } from 'next/headers';

export interface KpisData {
  revenue: number;
  ordersCount: number;
  averageTicket: number;
}

export interface SalesChartItem {
  date: string;
  total: number;
}

export interface TopProductItem {
  id: string;
  title: string;
  totalSold: number;
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

export async function getKpisAction(): Promise<{ success: boolean; data?: KpisData }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/analytics/kpis`, {
      method: 'GET',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch KPIs: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return { success: false };
  }
}

export async function getSalesChartAction(): Promise<{ success: boolean; data?: SalesChartItem[] }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/analytics/sales-chart`, {
      method: 'GET',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch sales chart: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching sales chart:', error);
    return { success: false };
  }
}

export async function getTopProductsAction(): Promise<{ success: boolean; data?: TopProductItem[] }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const headersObj = await getHeaders();

  try {
    const res = await fetch(`${apiUrl}/analytics/top-products`, {
      method: 'GET',
      headers: headersObj,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch top products: ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching top products:', error);
    return { success: false };
  }
}
