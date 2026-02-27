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

async function getBanner(): Promise<HomeBanner> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG!;

  const res = await fetch(`${apiUrl}/public/${tenant}/home/banner`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function Home() {
  const banner = await getBanner();

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="text-2xl font-semibold">ProyectoWeb Store</h1>

      {banner && (
        <section className="mt-6">
          {/* Desktop */}
          {banner.href ? (
            <a
              href={banner.href}
              className="relative hidden overflow-hidden rounded-2xl md:block"
            >
              <BannerDesktop banner={banner} />
            </a>
          ) : (
            <div className="relative hidden overflow-hidden rounded-2xl md:block">
              <BannerDesktop banner={banner} />
            </div>
          )}

          {/* Mobile */}
          {banner.href ? (
            <a href={banner.href} className="block md:hidden">
              <BannerMobile banner={banner} />
            </a>
          ) : (
            <div className="block md:hidden">
              <BannerMobile banner={banner} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function BannerDesktop({ banner }: { banner: NonNullable<HomeBanner> }) {
  return (
    <>
      <img
        src={banner.desktopImageUrl}
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

function BannerMobile({ banner }: { banner: NonNullable<HomeBanner> }) {
  return (
    <>
      <div className="overflow-hidden rounded-2xl">
        <img
          src={banner.mobileImageUrl}
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