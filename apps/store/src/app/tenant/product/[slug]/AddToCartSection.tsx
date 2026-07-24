"use client";

import { useState } from "react";
import Link from "next/link";

interface Variant {
  id: string;
  sku: string;
  title: string | null;
  price: number;
  compareAt: number | null;
  color: string | null;
  size: string | null;
  stockTotal: number;
}

interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  images: string[];
  minPrice: number | null;
  variants: Variant[];
}

export default function AddToCartSection({ product }: { product: ProductDetail }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id || ""
  );
  const [addedToast, setAddedToast] = useState(false);

  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId
  ) || product.variants[0];

  const formatARS = (cents: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleAddToCart = () => {
    const itemToAdd = {
      id: selectedVariant ? selectedVariant.id : product.id,
      product_id: product.id,
      variant_id: selectedVariant?.id || null,
      title: product.title + (selectedVariant?.title ? ` (${selectedVariant.title})` : ""),
      sku: selectedVariant?.sku || product.slug,
      quantity: 1,
      unit_price: selectedVariant ? selectedVariant.price / 100 : (product.minPrice ? product.minPrice / 100 : 0),
      image: product.coverImage || product.images?.[0] || "",
    };

    try {
      const existingCart = JSON.parse(localStorage.getItem("cart_items") || "[]");
      const existingIndex = existingCart.findIndex(
        (i: { id?: string }) => i.id === itemToAdd.id
      );

      if (existingIndex >= 0) {
        existingCart[existingIndex].quantity += 1;
      } else {
        existingCart.push(itemToAdd);
      }

      localStorage.setItem("cart_items", JSON.stringify(existingCart));
      setAddedToast(true);
      setTimeout(() => setAddedToast(false), 4000);
    } catch (e) {
      console.error("Error al guardar en el carrito:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de variantes si hay múltiples */}
      {product.variants && product.variants.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4 space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
            Selecciona una Variante
          </h3>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {product.variants.map((v) => {
              const isSelected = v.id === selectedVariantId;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-300 cursor-pointer group ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/10 hover:border-primary/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-primary transition-colors">
                      {(v.title ?? `${v.color ?? ""} ${v.size ?? ""}`.trim()) || v.sku}
                    </div>
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      SKU: {v.sku}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      {v.stockTotal > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          En stock ({v.stockTotal})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Sin stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                      {formatARS(v.price)}
                    </div>
                    {v.compareAt && v.compareAt > v.price && (
                      <div className="text-xs text-zinc-500 line-through">
                        {formatARS(v.compareAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acciones del Carrito */}
      <div className="border-t border-zinc-100 dark:border-zinc-900 pt-6 space-y-3">
        <button
          type="button"
          onClick={handleAddToCart}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/95 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all duration-300 active:scale-99 cursor-pointer group"
        >
          <span>🛒 Agregar al Carrito</span>
        </button>
      </div>

      {/* Toast Notificación flotante */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 rounded-2xl bg-zinc-900 border border-emerald-500/30 p-4 text-white shadow-2xl backdrop-blur-xl animate-fade-in max-w-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
              ✓
            </div>
            <div>
              <p className="text-sm font-bold text-white">¡Producto añadido!</p>
              <p className="text-xs text-zinc-400">
                {product.title} se guardó en tu carrito.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
            <button
              onClick={() => setAddedToast(false)}
              className="flex-1 py-2 px-3 text-xs font-semibold text-zinc-400 hover:text-white rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Seguir Comprando
            </button>
            <Link
              href="/tenant/checkout"
              className="flex-1 py-2 px-3 text-xs font-bold text-white text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
            >
              Ir a Pagar →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
