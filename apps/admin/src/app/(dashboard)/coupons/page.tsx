import React from 'react';
import { fetchCoupons } from './actions';
import CouponsList from './CouponsList';

export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  const result = await fetchCoupons(1);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Motor de Cupones y Descuentos
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Crea y administra los cupones de descuento activos para tu tienda.
          </p>
        </div>
      </div>

      {/* Coupons List */}
      <CouponsList initialCoupons={result.data || []} />
    </div>
  );
}
