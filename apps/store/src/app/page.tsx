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

  return (
    <main className="mx-auto max-w-6xl p-4">
      {/* Premium Header */}
      <header className="mb-8 rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Exclusivo
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{tenantConfig.tenantName}</h1>
            <p className="mt-2 text-white/95 text-sm md:text-base">
              ¡Bienvenido a nuestra tienda! Descubrí los mejores productos curados especialmente para vos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-white/90">
              Conexión Segura
            </span>
          </div>
        </div>
      </header>

      <h1 className="text-2xl font-semibold">ProyectoWeb Store</h1>

      {banner && (
        <section className="mt-6">
          {/* Desktop */}
          {banner.href ? (
            <a
              href={banner.href}
              className="relative hidden overflow-hidden rounded-2xl md:block"
            >
              <BannerDesktop banner={banner} apiUrl={apiUrl} />
            </a>
          ) : (
            <div className="relative hidden overflow-hidden rounded-2xl md:block">
              <BannerDesktop banner={banner} apiUrl={apiUrl} />
            </div>
          )}

          {/* Mobile */}
          {banner.href ? (
            <a href={banner.href} className="block md:hidden">
              <BannerMobile banner={banner} apiUrl={apiUrl} />
            </a>
          ) : (
            <div className="block md:hidden">
              <BannerMobile banner={banner} apiUrl={apiUrl} />
            </div>
          )}
        </section> 
      )}
      
      {/* PRODUCT GRID */}
      {products.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Productos</h2>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <a
                key={p.id}
                href={`/product/${p.slug}`}
                className="group rounded-xl border p-3 hover:shadow-sm"
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/5">
                  {p.coverImage && (
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="mt-1 text-sm opacity-70">
                    {p.minPrice != null
                      ? formatARSFromCents(p.minPrice)
                      : "Sin stock"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
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
        className="h-[420px] w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />

      <div className="absolute left-8 top-1/2 max-w-xl -translate-y-1/2 text-white">
        {banner.badge && (
          <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <div className="mt-3 text-4xl font-bold leading-tight">
            {banner.title}
          </div>
        )}
        {banner.subtitle && (
          <div className="mt-2 text-lg text-white/90">{banner.subtitle}</div>
        )}
        {banner.buttonText && (
          <div className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">
            {banner.buttonText}
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
    <>
      <div className="overflow-hidden rounded-2xl">
        <img
          src={src}
          alt={banner.alt ?? "Banner"}
          className="w-full object-cover"
        />
      </div>

      <div className="mt-3">
        {banner.badge && (
          <div className="inline-flex rounded-full border px-3 py-1 text-sm">
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <div className="mt-2 text-xl font-bold">{banner.title}</div>
        )}
        {banner.subtitle && (
          <div className="mt-1 text-base text-gray-600">{banner.subtitle}</div>
        )}
      </div>
    </>
  );
}