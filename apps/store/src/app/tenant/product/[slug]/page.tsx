import Link from "next/link";

type Variant = {
  id: string;
  sku: string;
  title: string | null;
  price: number;
  compareAt: number | null;
  color: string | null;
  size: string | null;
  stockTotal: number;
};

type ProductDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  images: string[];
  minPrice: number | null;
  variants: Variant[];
};

function formatARS(cents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}


export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG || "demo";

  const res = await fetch(`${apiUrl}/public/${tenant}/products/${slug}`, {
    cache: "force-cache",
    next: { tags: [`tenant:${tenant}:products`, `tenant:${tenant}:product:${slug}`] },
  });

  if (!res.ok) {
    return (
      <main className="mx-auto max-w-6xl p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <div className="text-4xl">🔍</div>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Producto no encontrado</h1>
        <Link href="/" className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black rounded-xl text-xs font-bold shadow-md hover:bg-zinc-800 transition-all">
          Volver a la tienda
        </Link>
      </main>
    );
  }

  const data: { product: ProductDetail } = await res.json();
  const p = data.product;

  const heroImg = p.coverImage ?? p.images?.[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-6 font-sans">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-350 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-all active:scale-95 cursor-pointer"
        >
          <span>←</span>
          <span>Volver al Inicio</span>
        </Link>
      </div>

      {/* Main Container */}
      <div className="grid gap-8 md:grid-cols-2 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 md:p-8 shadow-sm">
        {/* Gallery Image */}
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-850 aspect-square">
          {heroImg ? (
            <img
              src={heroImg}
              alt={p.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl bg-zinc-100 dark:bg-zinc-900">
              📦
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full text-primary">
                Disponible
              </span>
              <h1 className="mt-2 text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                {p.title}
              </h1>
            </div>

            {p.minPrice !== null && (
              <div className="inline-flex items-baseline gap-1 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                <span className="text-sm font-semibold text-zinc-500">desde</span>
                <span>{formatARS(p.minPrice)}</span>
              </div>
            )}

            {p.description && (
              <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider mb-2">
                  Descripción
                </h3>
                <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {p.description}
                </p>
              </div>
            )}

            {/* Variants Listing */}
            <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
                Variantes Disponibles
              </h3>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {p.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/10 p-3.5 transition-all duration-300 hover:border-primary/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-primary transition-colors">
                        {(v.title ?? `${v.color ?? ""} ${v.size ?? ""}`.trim()) || v.sku}
                      </div>
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">SKU: {v.sku}</div>
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
                      <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">{formatARS(v.price)}</div>
                      {v.compareAt && v.compareAt > v.price && (
                        <div className="text-xs text-zinc-500 line-through">
                          {formatARS(v.compareAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buy Button */}
          <div className="border-t border-zinc-100 dark:border-zinc-900 pt-6">
            <Link
              href="/checkout"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/95 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all duration-300 active:scale-99 cursor-pointer group"
            >
              <span>Comprar Ahora</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
