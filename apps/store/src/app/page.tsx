import { headers } from "next/headers";
import { fetchTenantConfig } from "./layout";

type HomeBanner =
  | {
      desktopImageUrl: string;
      mobileImageUrl: string;
      href?: string | null;
      alt?: string | null;
      badge?: string | null;
      title?: string | null;
      subtitle?: string | null;
      buttonText?: string | null;
    }
  | null;

function resolveImageUrl(apiUrl: string, url?: string | null) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Si es un upload local guardado como ruta relativa:
  if (trimmed.startsWith("/uploads/")) return `${apiUrl}${trimmed}`;
  // Si ya es URL absoluta (https://...):
  return trimmed;
}

async function getBanner(): Promise<HomeBanner> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG!;

  const res = await fetch(`${apiUrl}/public/${tenant}/home/banner`, {
    cache: "force-cache",
    next: { tags: [`tenant:${tenant}:banner`] },
  });

  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing banner JSON:", e);
    return null;
  }
}

type Product = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  minPrice: number | null;
};

async function getProducts(): Promise<Product[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG!;

  const res = await fetch(
    `${apiUrl}/public/${tenant}/products`,
    {
      cache: "force-cache",
      next: { tags: [`tenant:${tenant}:products`] },
    }
  );

  if (!res.ok) return [];

  const text = await res.text();
  if (!text.trim()) return [];
  try {
    const data = JSON.parse(text);
    return data.items ?? [];
  } catch (e) {
    console.error("Error parsing products JSON:", e);
    return [];
  }
}

function formatARSFromCents(cents: number) {
  const value = cents / 100;
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default async function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const banner = await getBanner();
  const products = await getProducts();

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const tenantConfig = await fetchTenantConfig(host);

  const logoSrc = tenantConfig.logo_url ? resolveImageUrl(apiUrl, tenantConfig.logo_url) : null;

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-8 font-sans">
      {/* Premium Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 md:p-10 text-white shadow-xl shadow-primary/10 transition-all duration-300">
        {/* Glow decorative blobs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={tenantConfig.tenantName}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover bg-white/10 p-1 backdrop-blur-md shadow-inner border border-white/20 transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex w-16 h-16 md:w-20 md:h-20 items-center justify-center rounded-2xl bg-white/20 text-white font-extrabold text-2xl border border-white/20 shadow-inner">
                {tenantConfig.tenantName.substring(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full border border-white/10">
                Tienda Oficial
              </span>
              <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">{tenantConfig.tenantName}</h1>
              <p className="mt-2 text-white/90 text-sm max-w-xl leading-relaxed">
                ¡Bienvenido a nuestra tienda! Descubrí los mejores productos curados especialmente para vos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {tenantConfig.whatsapp_phone && (
              <a
                href={`https://wa.me/${tenantConfig.whatsapp_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.035-4.496c1.677.995 3.327 1.579 5.922 1.58 5.434 0 9.856-4.417 9.859-9.856.002-2.633-1.02-5.107-2.879-6.97-1.859-1.863-4.33-2.883-6.963-2.885-5.438 0-9.859 4.417-9.862 9.857-.001 1.954.512 3.864 1.487 5.568l-.988 3.612 3.716-.974zm11.393-5.267c-.3-.15-1.776-.875-2.059-.978-.283-.102-.49-.153-.695.153-.205.307-.795.979-.974 1.183-.179.205-.359.23-.659.08-1.5-.752-2.585-1.307-3.626-3.088-.275-.469.275-.435.787-1.455.082-.164.041-.307-.02-.457-.062-.15-.49-1.183-.672-1.62-.177-.426-.357-.367-.49-.374-.128-.007-.275-.008-.421-.008-.146 0-.383.055-.584.275-.2.22-.764.746-.764 1.82 0 1.074.78 2.113.889 2.263.109.15 1.53 2.336 3.707 3.277.518.224.922.358 1.238.458.52.165.993.142 1.367.086.417-.062 1.776-.726 2.025-1.427.25-.7.25-1.302.175-1.427-.075-.125-.283-.2-.583-.35z"/>
                </svg>
                <span>WhatsApp</span>
              </a>
            )}
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur-md border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Conexión Segura</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      {banner && (
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200/60 dark:border-zinc-800/40 shadow-sm">
          {/* Desktop */}
          {banner.href ? (
            <a
              href={banner.href}
              className="relative hidden overflow-hidden rounded-3xl md:block group cursor-pointer"
            >
              <BannerDesktop banner={banner} apiUrl={apiUrl} />
            </a>
          ) : (
            <div className="relative hidden overflow-hidden rounded-3xl md:block">
              <BannerDesktop banner={banner} apiUrl={apiUrl} />
            </div>
          )}

          {/* Mobile */}
          {banner.href ? (
            <a href={banner.href} className="block md:hidden group cursor-pointer">
              <BannerMobile banner={banner} apiUrl={apiUrl} />
            </a>
          ) : (
            <div className="block md:hidden">
              <BannerMobile banner={banner} apiUrl={apiUrl} />
            </div>
          )}
        </section> 
      )}
      
      {/* PRODUCT GRID SECTION */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Nuestro Catálogo</h2>
          <span className="text-xs font-medium text-zinc-500">{products.length} productos disponibles</span>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <a
                key={p.id}
                href={`/product/${p.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:bg-zinc-950 dark:border-zinc-800 p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md cursor-pointer"
              >
                {/* Image Container */}
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 relative">
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl bg-zinc-150 dark:bg-zinc-900">
                      📦
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 shadow-md backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50">
                      →
                    </span>
                  </div>
                </div>

                {/* Details Container */}
                <div className="mt-4 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-primary transition-colors duration-200 line-clamp-2 min-h-[40px]">
                      {p.title}
                    </h3>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                      {p.minPrice != null ? formatARSFromCents(p.minPrice) : "Sin stock"}
                    </span>
                    {p.minPrice != null && (
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wider group-hover:underline">
                        Ver más
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          /* Elegant Empty State */
          <div className="flex flex-col items-center justify-center text-center p-12 md:p-20 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 backdrop-blur-sm max-w-2xl mx-auto space-y-6 shadow-inner">
            <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-md animate-pulse">
              <span className="text-4xl">🛍️</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-850 dark:text-zinc-100">Catálogo en Preparación</h3>
              <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
                ¡Gracias por visitarnos! Actualmente estamos preparando la mejor selección de productos para vos. Regresá pronto para ver las novedades.
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white px-5 py-3 text-xs font-bold text-white dark:text-black shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
            >
              🔄 Recargar Tienda
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

function BannerDesktop({
  banner,
  apiUrl,
}: {
  banner: NonNullable<HomeBanner>;
  apiUrl: string;
}) {
  const src = resolveImageUrl(apiUrl, banner.desktopImageUrl);

  return (
    <>
      <img
        src={src}
        alt={banner.alt ?? "Banner"}
        className="h-[420px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

      <div className="absolute left-10 top-1/2 max-w-xl -translate-y-1/2 text-white space-y-4">
        {banner.badge && (
          <span className="inline-flex rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-white/10">
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md">
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="text-base text-zinc-200/90 leading-relaxed max-w-lg">
            {banner.subtitle}
          </p>
        )}
        {banner.buttonText && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-100 px-5 py-2.5 text-xs font-bold text-black shadow-lg transition-all duration-300 active:scale-95 group-hover:scale-105">
            <span>{banner.buttonText}</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </div>
        )}
      </div>
    </>
  );
}

function BannerMobile({
  banner,
  apiUrl,
}: {
  banner: NonNullable<HomeBanner>;
  apiUrl: string;
}) {
  const src = resolveImageUrl(apiUrl, banner.mobileImageUrl);

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <img
          src={src}
          alt={banner.alt ?? "Banner"}
          className="w-full object-cover aspect-[4/3] transition-transform duration-500 group-hover:scale-103"
        />
      </div>

      <div className="space-y-3">
        {banner.badge && (
          <span className="inline-flex rounded-full bg-zinc-200/60 dark:bg-zinc-800/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {banner.title}
          </h3>
        )}
        {banner.subtitle && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {banner.subtitle}
          </p>
        )}
        {banner.buttonText && (
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/95 px-4 py-2.5 text-xs font-bold text-white shadow-md active:scale-95">
            <span>{banner.buttonText}</span>
            <span>→</span>
          </div>
        )}
      </div>
    </div>
  );
}