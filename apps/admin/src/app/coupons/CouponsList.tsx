'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { Coupon, createCouponAction, deactivateCouponAction } from './actions';

interface CouponsListProps {
  initialCoupons: Coupon[];
}

export default function CouponsList({ initialCoupons }: CouponsListProps) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [coupons, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este cupón?')) return;

    startTransition(async () => {
      const res = await deactivateCouponAction(id);
      if (res.success) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_active: false } : c))
        );
      } else {
        alert(res.error || 'No se pudo desactivar el cupón');
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!code.trim()) {
      setFormError('El código es obligatorio');
      return;
    }
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setFormError('El valor del descuento debe ser mayor a 0');
      return;
    }

    startTransition(async () => {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        valid_from: validFrom ? new Date(validFrom).toISOString() : undefined,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        is_active: isActive,
      };

      const res = await createCouponAction(payload);
      if (res.success && res.data) {
        setCoupons((prev) => [res.data!, ...prev]);
        setIsModalOpen(false);
        // Reset form
        setCode('');
        setDiscountType('percentage');
        setDiscountValue('');
        setValidFrom('');
        setValidUntil('');
        setUsageLimit('');
        setIsActive(true);
      } else {
        setFormError(res.error || 'Ocurrió un error al crear el cupón');
      }
    });
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'Sin límite';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDiscount = (type: 'percentage' | 'fixed_amount', val: number) => {
    if (type === 'percentage') {
      return `${val}%`;
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar with search and Action button */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-lg">
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-500 transition-all duration-200"
          />
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Cupón
        </button>
      </div>

      {/* Glassmorphic Table Container */}
      <div className="overflow-hidden bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Tipo Descuento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Válido Desde / Hasta</th>
                <th className="px-6 py-4">Límite / Usos</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-sm text-zinc-300">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No se encontraron cupones de descuento.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-zinc-900/30 transition-colors duration-200">
                    <td className="px-6 py-4 font-mono font-bold text-white tracking-wider">
                      {coupon.code}
                    </td>
                    <td className="px-6 py-4 capitalize">
                      {coupon.discount_type === 'percentage' ? 'Porcentaje' : 'Monto Fijo'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-100">
                      {formatDiscount(coupon.discount_type, coupon.discount_value)}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5">
                      <div className="text-zinc-400">
                        <span className="text-zinc-550">Desde:</span> {formatDate(coupon.valid_from)}
                      </div>
                      <div className="text-zinc-400">
                        <span className="text-zinc-550">Hasta:</span> {formatDate(coupon.valid_until)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="text-zinc-100 font-medium">
                        {coupon.times_used} usos
                      </div>
                      <div className="text-zinc-500">
                        Límite: {coupon.usage_limit ?? 'Ilimitado'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {coupon.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {coupon.is_active && (
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          disabled={isPending}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 disabled:opacity-50"
                          title="Desactivar cupón"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Slide-over / Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
              <h2 className="text-lg font-bold text-white">Crear Nuevo Cupón</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                  {formError}
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Código del Cupón</label>
                <input
                  type="text"
                  placeholder="Ej. VERANO50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                  required
                />
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Tipo Descuento</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed_amount')}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed_amount">Monto Fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Valor {discountType === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={discountType === 'percentage' ? 'Ej. 15' : 'Ej. 500'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Válido Desde</label>
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Válido Hasta</label>
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                  />
                </div>
              </div>

              {/* Limit usages */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Límite de Usos</label>
                <input
                  type="number"
                  placeholder="Ej. 100 (Opcional, vacío para ilimitado)"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-zinc-950 border-zinc-800 focus:ring-indigo-500/30"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-zinc-300 cursor-pointer">
                  Activar inmediatamente al crear
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all duration-300 disabled:opacity-50"
                >
                  {isPending ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  Crear Cupón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
