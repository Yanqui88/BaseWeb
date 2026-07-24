'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  importProductsCsvAction,
  getProductsAction,
  createProductAction,
  updateProductAction,
  deleteProductAction,
  getTenantSlugAction,
} from './actions';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
  image: string;
}

// ── Constantes de configuración ────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

// ── Tipos del resultado de importación ─────────────────────────────────────
interface ImportResult {
  success: boolean;
  message?: string;
  total?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ row: number; sku: string; reason: string }>;
}

// ── Estado del modal de importación ────────────────────────────────────────
type ImportModalState = 'idle' | 'dragging' | 'loading' | 'success' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal add/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);

  // CSV Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  // Fetch initial products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await getProductsAction();
        if (res.success) {
          const mapped = res.items.map((item: any) => ({
            id: item.id,
            name: item.title || item.name || 'Sin título',
            sku: item.sku || `SKU-${item.id.slice(0, 5)}`,
            price: Number(item.price) || 0,
            stock: Number(item.stock) || 0,
            status: (item.status || 'DRAFT').toLowerCase(),
            image: item.coverImage || item.image || '',
          }));
          setProducts(mapped);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    }
    fetchProducts();
  }, []);

  // ── Handlers CRUD ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
        const res = await deleteProductAction(id);
        if (res.success) {
          setProducts((prev) => prev.filter((p) => p.id !== id));
        } else {
          alert(res.error || 'Error al eliminar producto');
        }
      } catch (err) {
        console.error('Error deleting product:', err);
        alert('Error al eliminar producto');
      }
    }
  };

  const handleOpenAddModal = () => {
    setCurrentProduct({ id: '', name: '', sku: '', price: 0, stock: 0, status: 'draft', image: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setCurrentProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    const payload = {
      title: currentProduct.name || '',
      slug: (currentProduct.name ? currentProduct.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') : `product-${Date.now()}`),
      description: currentProduct.name || '',
      status: (currentProduct.status || 'draft').toUpperCase(),
      coverImage: currentProduct.image || '',
      price: Number(currentProduct.price) || 0,
      sku: currentProduct.sku || '',
      stock: Number(currentProduct.stock) || 0,
    };

    try {
      if (currentProduct.id) {
        const res = await updateProductAction(currentProduct.id, payload);
        if (res.success && res.data) {
          const updated: Product = {
            id: res.data.id || currentProduct.id,
            name: res.data.title || currentProduct.name || '',
            sku: currentProduct.sku || 'SKU-001',
            price: Number(currentProduct.price) || 0,
            stock: Number(currentProduct.stock) || 0,
            status: (res.data.status || 'DRAFT').toLowerCase() as Product['status'],
            image: res.data.coverImage || currentProduct.image || '',
          };
          setProducts((prev) => prev.map((p) => (p.id === currentProduct.id ? updated : p)));
          setIsModalOpen(false);
          setCurrentProduct(null);
        } else {
          alert(res.error || 'Error al actualizar el producto');
        }
      } else {
        const res = await createProductAction(payload);
        if (res.success && res.data) {
          const created: Product = {
            id: res.data.id,
            name: res.data.title || currentProduct.name || '',
            sku: currentProduct.sku || 'SKU-001',
            price: Number(currentProduct.price) || 0,
            stock: Number(currentProduct.stock) || 0,
            status: (res.data.status || 'DRAFT').toLowerCase() as Product['status'],
            image: res.data.coverImage || currentProduct.image || '',
          };
          setProducts((prev) => [created, ...prev]);
          setIsModalOpen(false);
          setCurrentProduct(null);
        } else {
          alert(res.error || 'Error al crear el producto');
        }
      }
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Error al guardar el producto');
    }
  };

  // ── EXPORTAR CSV ──────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const slug = await getTenantSlugAction();
      const res = await fetch(`${API_BASE}/admin/${slug}/products/export`, {
        method: 'GET',
        headers: { 'x-tenant-domain': window.location.hostname },
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const filenameMatch = cd.match(/filename="?([^"]+)"?/);
      link.download = filenameMatch?.[1] || `productos-${TENANT_SLUG}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (_err) {
      alert('No se pudo exportar el archivo CSV. Verifica que el servidor esté activo.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  // ── IMPORTAR CSV ──────────────────────────────────────────────────────────
  const handleOpenImportModal = () => {
    setImportState('idle');
    setImportResult(null);
    setSelectedFile(null);
    setIsDragOver(false);
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    if (importState === 'loading') return;
    setIsImportModalOpen(false);
    setImportState('idle');
    setImportResult(null);
    setSelectedFile(null);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setImportResult({ success: false, message: 'Solo se permiten archivos .csv' });
      setImportState('error');
      return;
    }
    setSelectedFile(file);
    setImportState('idle');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImportSubmit = async () => {
    if (!selectedFile) return;

    setImportState('loading');
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const result = await importProductsCsvAction(formData);
    setImportResult(result);
    setImportState(result.success ? 'success' : 'error');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header Section ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Productos</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Administra el catálogo de productos disponibles en tu tienda virtual.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exportar CSV */}
          <button
            id="btn-export-csv"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-200 hover:text-white font-semibold text-sm rounded-xl transition-all duration-200 border border-zinc-700 hover:border-zinc-600 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </button>

          {/* Importar CSV */}
          <button
            id="btn-import-csv"
            onClick={handleOpenImportModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-98 text-emerald-400 hover:text-emerald-300 font-semibold text-sm rounded-xl transition-all duration-200 border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
          </button>

          {/* Añadir producto */}
          <button
            id="btn-add-product"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-semibold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Añadir Producto
          </button>
        </div>
      </div>

      {/* ── Control Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-md">
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

      {/* ── Tabla de Productos ─────────────────────────────────────────────── */}
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
                      <td className="px-6 py-4 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-zinc-800 border border-zinc-850 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-850 shrink-0 flex items-center justify-center text-zinc-500 font-bold uppercase">
                            {p.name.charAt(0)}
                          </div>
                        )}
                        <div className="font-medium text-white truncate max-w-[200px]" title={p.name}>{p.name}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">{p.sku}</td>
                      <td className="px-6 py-4 text-right font-semibold text-white">${(Number(p.price) || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">{stockBadge}</td>
                      <td className="px-6 py-4">{statusBadge}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button onClick={() => handleOpenEditModal(p)} className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850 hover:bg-indigo-650 hover:text-white transition-all duration-200" title="Editar Producto">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850 hover:bg-red-600 hover:text-white transition-all duration-200" title="Eliminar Producto">
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

      {/* ── Modal: Añadir / Editar Producto ───────────────────────────────── */}
      {isModalOpen && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/30">
              <h3 className="text-lg font-bold text-white">
                {currentProduct.id ? 'Editar Producto' : 'Añadir Nuevo Producto'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setCurrentProduct(null); }} className="text-zinc-500 hover:text-white transition-colors" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Nombre del Producto</label>
                <input type="text" required value={currentProduct.name || ''} onChange={(e) => setCurrentProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" placeholder="ej. Apple Vision Pro" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">SKU</label>
                  <input type="text" required value={currentProduct.sku || ''} onChange={(e) => setCurrentProduct(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" placeholder="AVP-512GB" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Precio ($)</label>
                  <input type="number" step="0.01" min="0" required value={currentProduct.price || ''} onChange={(e) => setCurrentProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" placeholder="3499.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Cantidad Stock</label>
                  <input type="number" min="0" required value={currentProduct.stock === undefined ? '' : currentProduct.stock} onChange={(e) => setCurrentProduct(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Estado</label>
                  <select value={currentProduct.status || 'draft'} onChange={(e) => setCurrentProduct(prev => ({ ...prev, status: e.target.value as Product['status'] }))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white">
                    <option value="active">Activo</option>
                    <option value="draft">Borrador</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">URL de Imagen de Portada</label>
                <input type="url" value={currentProduct.image || ''} onChange={(e) => setCurrentProduct(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" placeholder="https://ejemplo.com/imagen.jpg" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
                <button type="button" onClick={() => { setIsModalOpen(false); setCurrentProduct(null); }} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Importar CSV ────────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Gradient top border */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            {/* Ambient glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Importar Productos</h3>
                  <p className="text-xs text-zinc-500">Carga masiva desde archivo CSV</p>
                </div>
              </div>
              <button
                onClick={handleCloseImportModal}
                disabled={importState === 'loading'}
                className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="relative p-6 space-y-5">

              {/* Formato esperado */}
              <div className="px-4 py-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-300 mb-1.5">📋 Formato requerido del CSV:</p>
                <code className="text-indigo-400 font-mono">nombre, sku, precio, stock, descripcion, estado</code>
                <p className="mt-1 text-zinc-500">El campo <span className="text-zinc-300">sku</span> es el identificador único para Upsert. Estado: DRAFT | ACTIVE | ARCHIVED</p>
              </div>

              {/* Drop Zone */}
              {importState !== 'success' && importState !== 'loading' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                    isDragOver
                      ? 'border-emerald-400/60 bg-emerald-500/5 scale-[1.01]'
                      : selectedFile
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-zinc-700 bg-zinc-950/40 hover:border-zinc-600 hover:bg-zinc-950/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {selectedFile ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB • Listo para importar</p>
                      </div>
                      <span className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors">Clic para cambiar archivo</span>
                    </>
                  ) : (
                    <>
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors duration-300 ${isDragOver ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900 border-zinc-700'}`}>
                        <svg className={`w-6 h-6 transition-colors duration-300 ${isDragOver ? 'text-emerald-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-300">
                          {isDragOver ? '¡Suelta aquí el archivo!' : 'Arrastra y suelta tu CSV'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">o <span className="text-indigo-400">haz clic para explorar</span> · Máximo 5 MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Estado: Cargando */}
              {importState === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-emerald-400 animate-spin" />
                    <div className="absolute inset-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">Procesando importación…</p>
                    <p className="text-xs text-zinc-500 mt-1">Validando y ejecutando Upsert en base de datos</p>
                  </div>
                </div>
              )}

              {/* Estado: Éxito */}
              {importState === 'success' && importResult && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">Importación completada</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{importResult.message}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total', value: importResult.total ?? 0, color: 'text-zinc-300', bg: 'bg-zinc-800/60' },
                      { label: 'Nuevos', value: importResult.inserted ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
                      { label: 'Actualizados', value: importResult.updated ?? 0, color: 'text-indigo-400', bg: 'bg-indigo-500/8' },
                      { label: 'Omitidos', value: importResult.skipped ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/8' },
                    ].map((stat) => (
                      <div key={stat.label} className={`${stat.bg} rounded-xl px-3 py-3 text-center border border-zinc-800/50`}>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Errores de filas */}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
                      <div className="px-3 py-2 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Filas con errores ({importResult.errors.length})
                      </div>
                      <div className="divide-y divide-zinc-800/50">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="px-3 py-2 text-xs">
                            <span className="text-zinc-500">Fila {err.row}</span>
                            {err.sku && <span className="ml-2 text-amber-400 font-mono">{err.sku}</span>}
                            <p className="text-zinc-400 mt-0.5">{err.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Estado: Error general */}
              {importState === 'error' && importResult && !importResult.inserted && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-400">Error en la importación</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{importResult.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="relative flex justify-between items-center px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/20">
              <button onClick={handleCloseImportModal} disabled={importState === 'loading'} className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-40">
                {importState === 'success' ? 'Cerrar' : 'Cancelar'}
              </button>

              {importState !== 'success' && importState !== 'loading' && (
                <button
                  id="btn-confirm-import"
                  onClick={handleImportSubmit}
                  disabled={!selectedFile}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Iniciar Importación
                </button>
              )}

              {importState === 'success' && (
                <button
                  onClick={() => {
                    setImportState('idle');
                    setSelectedFile(null);
                    setImportResult(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Importar otro archivo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
