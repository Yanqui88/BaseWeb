import React from 'react';

interface TopProductItem {
  id: string;
  title: string;
  totalSold: number;
}

interface TopProductsProps {
  products: TopProductItem[];
}

export default function TopProducts({ products }: TopProductsProps) {
  // Find maximum sold items to calculate relative width for progress bars
  const maxSold = products && products.length > 0 ? products[0].totalSold : 1;

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-6">
        <svg className="w-12 h-12 text-zinc-700 animate-pulse mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span className="text-sm text-zinc-500">No hay productos vendidos disponibles</span>
      </div>
    );
  }

  // Predefined colors for positions 1-5
  const rankColors = [
    {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10',
      bar: 'from-amber-500 to-yellow-500',
    },
    {
      badge: 'bg-slate-300/10 text-slate-300 border-slate-300/20 shadow-slate-300/10',
      bar: 'from-slate-400 to-slate-300',
    },
    {
      badge: 'bg-amber-700/10 text-amber-600 border-amber-700/20 shadow-amber-700/10',
      bar: 'from-amber-600 to-amber-700',
    },
    {
      badge: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50',
      bar: 'from-indigo-500 to-blue-500',
    },
    {
      badge: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50',
      bar: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-6 relative overflow-hidden shadow-xl flex flex-col justify-between h-full">
      {/* Background Glow */}
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 mb-6">
        <h3 className="text-lg font-bold text-white tracking-wide">Productos Estrella</h3>
        <p className="text-xs text-zinc-500">Los 5 productos más vendidos del catálogo</p>
      </div>

      <div className="relative z-10 space-y-5 flex-1 flex flex-col justify-center">
        {products.map((product, idx) => {
          const percentage = maxSold > 0 ? (product.totalSold / maxSold) * 100 : 0;
          const style = rankColors[idx] || rankColors[3];

          return (
            <div key={product.id} className="group flex flex-col gap-2 transition-all duration-300 hover:translate-x-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Position Badge */}
                  <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold border shadow-inner ${style.badge}`}>
                    {idx + 1}
                  </span>
                  {/* Product Title */}
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-white truncate transition-colors duration-200">
                    {product.title}
                  </span>
                </div>
                {/* Total Sold Badge */}
                <div className="text-right">
                  <span className="text-sm font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors duration-200">
                    {product.totalSold}
                  </span>
                  <span className="text-[10px] text-zinc-500 ml-1">uds</span>
                </div>
              </div>

              {/* Custom Progress Bar */}
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/30">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${style.bar} transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
