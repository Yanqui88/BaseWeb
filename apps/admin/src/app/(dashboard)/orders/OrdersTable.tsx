'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Order } from 'shared';

interface OrdersTableProps {
  initialOrders: Order[];
}

export default function OrdersTable({ initialOrders }: OrdersTableProps) {
  const [orders] = useState<Order[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [shippingFilter, setShippingFilter] = useState<string>('all');

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
      const matchesShipping = shippingFilter === 'all' || o.shipping_status === shippingFilter;
      return matchesSearch && matchesPayment && matchesShipping;
    });
  }, [orders, searchQuery, paymentFilter, shippingFilter]);

  // Formatter for currency
  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(num);
  };

  // Formatter for dates
  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Payment badge helper
  const renderPaymentBadge = (status: Order['payment_status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Aprobado
          </span>
        );
      case 'pending':
      case 'in_process':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pendiente
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Rechazado
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            Reembolsado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  // Shipping badge helper
  const renderShippingBadge = (status: Order['shipping_status']) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Entregado
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            En camino
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Listo para retirar
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar with search and filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-md">
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por ID, nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-550 transition-all duration-200"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Payment Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-550 whitespace-nowrap">Pago:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todos</option>
              <option value="approved">Aprobados</option>
              <option value="pending">Pendientes</option>
              <option value="rejected">Rechazados</option>
              <option value="refunded">Reembolsados</option>
            </select>
          </div>

          {/* Shipping Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-550 whitespace-nowrap">Envío:</span>
            <select
              value={shippingFilter}
              onChange={(e) => setShippingFilter(e.target.value)}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="in_transit">En camino</option>
              <option value="ready_for_pickup">Listo para retirar</option>
              <option value="delivered">Entregados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">ID Orden</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Estado Pago</th>
                <th className="px-6 py-4 text-center">Estado Envío</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const shortId = order.id.slice(-8).toUpperCase();
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-zinc-850/20 hover:scale-[1.002] border-transparent hover:border-zinc-700/30 border-l-2 transition-all duration-200"
                    >
                      {/* Short ID */}
                      <td className="px-6 py-4 font-mono text-zinc-450 font-semibold">
                        #{shortId}
                      </td>

                      {/* Customer Name & Email */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{order.customer_name}</div>
                        <div className="text-xs text-zinc-500">{order.customer_email}</div>
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 text-right font-bold text-white">
                        {formatCurrency(order.total)}
                      </td>

                      {/* Payment Status */}
                      <td className="px-6 py-4 text-center">
                        {renderPaymentBadge(order.payment_status)}
                      </td>

                      {/* Shipping Status */}
                      <td className="px-6 py-4 text-center">
                        {renderShippingBadge(order.shipping_status)}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-xs text-zinc-400 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/60 hover:bg-indigo-650 hover:text-white border border-zinc-800 hover:border-indigo-500 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer shadow-sm"
                        >
                          Ver detalle
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                    <svg className="w-12 h-12 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    No se encontraron órdenes coincidentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
