'use client';

import React, { useState, useMemo } from 'react';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
  image: string;
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'iPhone 15 Pro Max',
    sku: 'IPH15-PM-256',
    price: 1399.00,
    stock: 24,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=80&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  },
  {
    id: 'prod-2',
    name: 'MacBook Pro 14" M3',
    sku: 'MBP-M3-16GB',
    price: 1999.00,
    stock: 8,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  },
  {
    id: 'prod-3',
    name: 'AirPods Pro 2',
    sku: 'APP2-W-CASE',
    price: 249.00,
    stock: 0,
    status: 'draft',
    image: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=80&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  },
  {
    id: 'prod-4',
    name: 'Apple Watch Ultra 2',
    sku: 'AWU2-49MM',
    price: 799.00,
    stock: 3,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=80&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleOpenAddModal = () => {
    setCurrentProduct({
      id: '',
      name: '',
      sku: '',
      price: 0,
      stock: 0,
      status: 'draft',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' // generic device mock
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setCurrentProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    if (currentProduct.id) {
      // Edit mode
      setProducts((prev) =>
        prev.map((p) => (p.id === currentProduct.id ? (currentProduct as Product) : p))
      );
    } else {
      // Add mode
      const newProduct: Product = {
        ...(currentProduct as Omit<Product, 'id'>),
        id: `prod-${Date.now()}`,
      };
      setProducts((prev) => [...prev, newProduct]);
    }
    setIsModalOpen(false);
    setCurrentProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Productos</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Administra el catálogo de productos disponibles en tu tienda virtual.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 active:scale-98 text-white font-semibold text-sm rounded-xl transition-all duration-305 shadow-lg shadow-indigo-600/10 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Añadir Producto
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-md">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-550">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-500 transition-all duration-200"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-zinc-500 whitespace-nowrap">Estado:</span>
          {(['all', 'active', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                statusFilter === status
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              {status === 'all' ? 'Todos' : status === 'active' ? 'Activo' : status === 'draft' ? 'Borrador' : 'Archivado'}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4 text-right">Precio</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  // Stock badges logic
                  let stockBadge = (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {p.stock} u.
                    </span>
                  );
                  if (p.stock === 0) {
                    stockBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        Agotado
                      </span>
                    );
                  } else if (p.stock <= 5) {
                    stockBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {p.stock} u. (Crítico)
                      </span>
                    );
                  }

                  // Status badge logic
                  const statusBadge = p.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Activo
                    </span>
                  ) : p.status === 'draft' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 bg-zinc-850 px-2 py-0.5 rounded-md border border-zinc-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      Borrador
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-450 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Archivado
                    </span>
                  );

                  return (
                    <tr key={p.id} className="hover:bg-zinc-850/30 transition-colors duration-150">
                      {/* Image and Name */}
                      <td className="px-6 py-4 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover bg-zinc-800 border border-zinc-850"
                        />
                        <div className="font-medium text-white truncate max-w-[200px]" title={p.name}>
                          {p.name}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">{p.sku}</td>

                      {/* Price */}
                      <td className="px-6 py-4 text-right font-semibold text-white">
                        ${p.price.toFixed(2)}
                      </td>

                      {/* Stock */}
                      <td className="px-6 py-4 text-center">{stockBadge}</td>

                      {/* Status */}
                      <td className="px-6 py-4">{statusBadge}</td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850 hover:bg-indigo-650 hover:text-white transition-all duration-200"
                            title="Editar Producto"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850 hover:bg-red-600 hover:text-white transition-all duration-200"
                            title="Eliminar Producto"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <svg className="w-12 h-12 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/30">
              <h3 className="text-lg font-bold text-white">
                {currentProduct.id ? 'Editar Producto' : 'Añadir Nuevo Producto'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentProduct(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={currentProduct.name || ''}
                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                  placeholder="ej. Apple Vision Pro"
                />
              </div>

              {/* SKU & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={currentProduct.sku || ''}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                    placeholder="AVP-512GB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={currentProduct.price || ''}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                    placeholder="3499.00"
                  />
                </div>
              </div>

              {/* Stock & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Cantidad Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentProduct.stock === undefined ? '' : currentProduct.stock}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Estado
                  </label>
                  <select
                    value={currentProduct.status || 'draft'}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, status: e.target.value as Product['status'] }))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                  >
                    <option value="active">Activo</option>
                    <option value="draft">Borrador</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  URL de Imagen de Portada
                </label>
                <input
                  type="url"
                  value={currentProduct.image || ''}
                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white"
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCurrentProduct(null);
                  }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 active:scale-98 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
