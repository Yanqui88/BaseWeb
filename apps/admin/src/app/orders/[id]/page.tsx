import React from 'react';
import Link from 'next/link';
import { fetchOrderDetail } from '../actions';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const resolvedParams = await params;
  const order = await fetchOrderDetail(resolvedParams.id);

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Orden No Encontrada</h2>
        <p className="text-sm text-zinc-400 max-w-sm">
          No pudimos encontrar los detalles de la orden con ID #{resolvedParams.id}. Puede que no exista o pertenezca a otro comercio.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-semibold text-white transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Órdenes
        </Link>
      </div>
    );
  }

  // Currency formatter
  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(num);
  };

  // Date formatter
  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Payment badge helper
  const renderPaymentBadge = (status: typeof order.payment_status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Pago Aprobado
          </span>
        );
      case 'pending':
      case 'in_process':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pago Pendiente
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Pago Rechazado
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            Pago Reembolsado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  // Shipping badge helper
  const renderShippingBadge = (status: typeof order.shipping_status) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Envío Entregado
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Envío en Camino (Andreani)
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Listo para Retirar
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Envío Pendiente
          </span>
        );
    }
  };

  const address = order.shipping_address;

  return (
    <div className="space-y-6">
      {/* Detail Header navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-350 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver al listado
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-white">
              Orden #{order.id.slice(-8).toUpperCase()}
            </h1>
            <div className="flex gap-2">
              {renderPaymentBadge(order.payment_status)}
              {renderShippingBadge(order.shipping_status)}
            </div>
          </div>
          <p className="text-xs text-zinc-550">
            Registrada el {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer details, address, payment refs (Span 1) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Card */}
          <div className="p-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-lg backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500/20" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Datos del Cliente
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block">Nombre</span>
                <span className="font-semibold text-white">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Email</span>
                <span className="font-semibold text-white break-all">{order.customer_email}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Teléfono</span>
                <span className="font-semibold text-white">{order.customer_phone || 'No especificado'}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Documento (DNI/CUIT)</span>
                <span className="font-semibold text-white font-mono">{order.customer_document || 'No especificado'}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="p-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-lg backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500/20" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Dirección de Entrega
            </h2>
            {address ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-zinc-500 block">Calle y Altura</span>
                  <span className="font-semibold text-white">
                    {address.street} {address.number}
                    {address.floor ? ` - Piso/Dpto: ${address.floor}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block">Localidad</span>
                  <span className="font-semibold text-white">{address.city}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block">Provincia y CP</span>
                  <span className="font-semibold text-white">
                    {address.state} (CP {address.zip_code})
                  </span>
                </div>
                {address.country && (
                  <div>
                    <span className="text-xs text-zinc-500 block">País</span>
                    <span className="font-semibold text-white">{address.country}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-800/40 text-xs text-zinc-400">
                  <span className="block">Método seleccionado:</span>
                  <span className="font-bold text-indigo-300 uppercase mt-0.5 block">
                    {order.shipping_method === 'pickup' ? 'Retiro en sucursal' : order.shipping_method === 'andreani_standard' ? 'Andreani Estándar' : order.shipping_method === 'andreani_express' ? 'Andreani Express' : order.shipping_method === 'moto_local' ? 'Moto Local' : order.shipping_method || 'No especificado'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">No requiere envío físico.</p>
            )}
          </div>

          {/* Reference IDs Card */}
          <div className="p-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-lg backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500/20" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Referencias de Integración
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-550 block">ID Transacción Mercado Pago</span>
                <span className="font-mono font-semibold text-white break-all">
                  {order.mp_transaction_id || 'N/A (Pago no procesado)'}
                </span>
              </div>
              <div>
                <span className="text-zinc-550 block">Nro Seguimiento Andreani</span>
                {order.shipping_tracking_number ? (
                  <span className="inline-flex items-center gap-1.5 mt-0.5 font-mono font-bold text-indigo-450 bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10">
                    {order.shipping_tracking_number}
                  </span>
                ) : (
                  <span className="text-zinc-500 italic">N/A (Etiqueta no generada)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Items and Totals (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Card */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="px-6 py-5 border-b border-zinc-800/60 bg-zinc-950/20">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Detalle del Pedido
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/60 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="px-6 py-3">Producto</th>
                    <th className="px-6 py-3 text-right">Precio Unitario</th>
                    <th className="px-6 py-3 text-center">Cant.</th>
                    <th className="px-6 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 text-sm text-zinc-300">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-850/10 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">
                            {item.product_title || 'Producto Eliminado o Desconocido'}
                          </div>
                          <div className="text-xs font-mono text-zinc-500">ID: {item.product_id}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-zinc-400">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-zinc-200">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white font-mono">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 italic">
                        La orden no contiene ningún artículo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals Summary Card */}
          <div className="p-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-lg backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Resumen de Totales</span>
              <span className="text-sm text-zinc-400 block">
                Los montos corresponden a moneda local (ARS) y se congelan en la fecha de emisión.
              </span>
            </div>
            <div className="w-full md:w-64 space-y-2 border-t md:border-t-0 md:border-l border-zinc-800/80 pt-4 md:pt-0 md:pl-6 text-sm">
              <div className="flex justify-between text-zinc-450">
                <span>Subtotal</span>
                <span className="font-mono text-white">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-450">
                <span>Costo de Envío</span>
                <span className="font-mono text-white">
                  {parseFloat(order.shipping_cost) === 0 ? 'Gratis' : formatCurrency(order.shipping_cost)}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/80 pt-2 text-base font-black text-white">
                <span>Total</span>
                <span className="font-mono text-indigo-400 text-lg">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
