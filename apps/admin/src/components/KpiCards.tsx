import React from 'react';

interface KpiCardsProps {
  revenue: number;
  ordersCount: number;
  averageTicket: number;
}

export default function KpiCards({ revenue, ordersCount, averageTicket }: KpiCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const kpis = [
    {
      title: 'Ingresos del Mes',
      value: formatCurrency(revenue),
      description: 'Ventas aprobadas en el mes en curso',
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      glowColor: 'from-emerald-500/10 to-teal-500/5',
      borderColor: 'group-hover:border-emerald-500/30',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Cantidad de Órdenes',
      value: ordersCount.toLocaleString('es-CL'),
      description: 'Transacciones completadas con éxito',
      icon: (
        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      glowColor: 'from-indigo-500/10 to-blue-500/5',
      borderColor: 'group-hover:border-indigo-500/30',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Ticket Promedio',
      value: formatCurrency(averageTicket),
      description: 'Monto promedio por compra',
      icon: (
        <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      ),
      glowColor: 'from-purple-500/10 to-pink-500/5',
      borderColor: 'group-hover:border-purple-500/30',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          className={`group relative overflow-hidden rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 ${kpi.borderColor}`}
        >
          {/* Ambient Background Gradient for Hover Effect */}
          <div className={`absolute inset-0 bg-gradient-to-br ${kpi.glowColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

          <div className="p-6 relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-zinc-400 tracking-wide uppercase">{kpi.title}</span>
              <div className={`flex items-center justify-center w-11 h-11 rounded-xl border ${kpi.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                {kpi.icon}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-3xl font-bold text-white tracking-tight leading-none transition-all duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-300">
                {kpi.value}
              </h3>
              <p className="mt-2 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300">
                {kpi.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
