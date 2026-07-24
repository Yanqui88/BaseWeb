import React from 'react';
import { cookies, headers } from 'next/headers';
import KpiCards from '@/components/KpiCards';
import SalesChart from '@/components/SalesChart';
import TopProducts from '@/components/TopProducts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const tenantDomain = host.split(':')[0];

  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

  const headersObj: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-domain': tenantDomain,
  };

  if (token) {
    headersObj['Authorization'] = `Bearer ${token}`;
  }

  // Fetch KPIs
  let kpisRes = { success: false, data: undefined as any };
  try {
    const res = await fetch(`${apiUrl}/analytics/kpis`, { headers: headersObj, cache: 'no-store' });
    if (res.ok) kpisRes = { success: true, data: await res.json() };
    else console.error('Error KPIs:', res.statusText);
  } catch (err) {}

  // Fetch Sales
  let salesChartRes = { success: false, data: undefined as any };
  try {
    const res = await fetch(`${apiUrl}/analytics/sales-chart`, { headers: headersObj, cache: 'no-store' });
    if (res.ok) salesChartRes = { success: true, data: await res.json() };
    else console.error('Error Sales:', res.statusText);
  } catch (err) {}

  // Fetch Top Products
  let topProductsRes = { success: false, data: undefined as any };
  try {
    const res = await fetch(`${apiUrl}/analytics/top-products`, { headers: headersObj, cache: 'no-store' });
    if (res.ok) topProductsRes = { success: true, data: await res.json() };
    else console.error('Error Top Products:', res.statusText);
  } catch (err) {}

  // Generamos datos de demostración como fallback para asegurar que el dashboard
  // siempre se vea espectacular aun cuando no haya datos en la base de datos o el token haya expirado.
  const fallbackKpis = {
    revenue: 0,
    ordersCount: 0,
    averageTicket: 0,
  };

  const fallbackSalesData: any[] = [];

  const fallbackTopProducts: any[] = [];

  const hasRealData = kpisRes.success && salesChartRes.success && topProductsRes.success;
  
  const kpis = kpisRes.success && kpisRes.data ? kpisRes.data : fallbackKpis;
  const salesData = salesChartRes.success && salesChartRes.data ? salesChartRes.data : fallbackSalesData;
  const topProducts = topProductsRes.success && topProductsRes.data ? topProductsRes.data : fallbackTopProducts;

  const currentDate = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome & Context Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white transition-all duration-300 hover:text-indigo-400">
            Analítica y Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Monitorea el rendimiento de tu negocio en tiempo real. {currentDate}
          </p>
        </div>

        {/* Status indicator / Live badge */}
        <div className="flex items-center gap-3">
          {!hasRealData ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 shadow-sm shadow-amber-500/5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Modo Demostración (Offline/No Auth)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 shadow-sm shadow-emerald-500/5 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conexión en Vivo</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <KpiCards
        revenue={kpis.revenue}
        ordersCount={kpis.ordersCount}
        averageTicket={kpis.averageTicket}
      />

      {/* Analytics Visuals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart Container (Takes 2 columns) */}
        <div className="lg:col-span-2">
          <SalesChart data={salesData} />
        </div>

        {/* Top Products Container (Takes 1 column) */}
        <div className="lg:col-span-1">
          <TopProducts products={topProducts} />
        </div>
      </div>

      {/* Informational Glass Banner */}
      <div className="rounded-2xl bg-zinc-900/30 backdrop-blur-md border border-zinc-800/60 p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">¿Cómo funciona este panel?</h4>
              <p className="text-xs text-zinc-400 mt-1">
                La información de KPIs e ingresos se calcula directamente en PostgreSQL a partir de órdenes con pago aprobado.
              </p>
            </div>
          </div>
          <button className="px-4 py-2 rounded-xl bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all duration-200">
            Ver Configuración
          </button>
        </div>
      </div>
    </div>
  );
}
