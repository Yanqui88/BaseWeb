import React from 'react';
import { fetchOrders } from './actions';
import OrdersTable from './OrdersTable';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const orders = await fetchOrders(1);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Órdenes de Compra
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Gestiona los pedidos de tus clientes, pagos de Mercado Pago y despachos de correo nacional.
        </p>
      </div>

      {/* Orders Table */}
      <OrdersTable initialOrders={orders} />
    </div>
  );
}
