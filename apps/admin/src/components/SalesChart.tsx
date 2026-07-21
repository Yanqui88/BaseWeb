'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface SalesChartItem {
  date: string;
  total: number;
}

interface SalesChartProps {
  data: SalesChartItem[];
}

export default function SalesChart({ data }: SalesChartProps) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const dateVal = payload[0].payload.date;
      
      const formattedVal = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(value);

      return (
        <div className="bg-zinc-950/90 border border-zinc-800/80 px-4 py-2.5 rounded-xl backdrop-blur-md shadow-2xl">
          <p className="text-xs text-zinc-500 font-medium mb-1">
            {new Date(dateVal).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm" />
            <span className="text-sm font-bold text-white">Ventas:</span>
            <span className="text-sm font-bold text-indigo-400">{formattedVal}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Fallback in case of empty data
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80">
        <svg className="w-12 h-12 text-zinc-700 animate-pulse mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
        <span className="text-sm text-zinc-500">No hay datos de ventas disponibles</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-6 relative overflow-hidden shadow-xl">
      {/* Background Glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide">Evolución de Ventas</h3>
          <p className="text-xs text-zinc-500">Últimos 30 días de transacciones aprobadas</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs font-semibold text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Ingreso Total Diario</span>
        </div>
      </div>

      <div className="h-[300px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4' }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#818cf8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#salesGrad)"
              activeDot={{ r: 6, stroke: '#312e81', strokeWidth: 2, fill: '#818cf8' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
