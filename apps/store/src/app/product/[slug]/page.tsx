import Link from "next/dist/client/link";
//import Link from "next/link";

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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG!;

  const res = await fetch(`${apiUrl}/public/${tenant}/products/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-semibold">Producto no encontrado</h1>
      </main>
    );
  }

  const data: { product: ProductDetail } = await res.json();
  const p = data.product;

  const heroImg = p.coverImage ?? p.images?.[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl p-4">
      <Link href="/" className="text-sm text-gray-600 underline">
        ← Volver
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          {heroImg ? (
            <img
              src={heroImg}
              alt={p.title}
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-2xl bg-gray-100" />
          )}
        </div>

        <div>
          <h1 className="text-3xl font-semibold">{p.title}</h1>
          {p.minPrice !== null && (
            <div className="mt-2 text-xl font-semibold">
              Desde {formatARS(p.minPrice)}
            </div>
          )}

          {p.description && (
            <p className="mt-4 whitespace-pre-line text-gray-700">
              {p.description}
            </p>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold">Variantes</h2>

            <div className="mt-3 space-y-2">
              {p.variants.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {(v.title ?? `${v.color ?? ""} ${v.size ?? ""}`.trim()) || v.sku}
                    </div>
                    <div className="text-sm text-gray-600">SKU: {v.sku}</div>
                    <div className="mt-1 text-sm">
                      {v.stockTotal > 0 ? (
                        <span className="text-green-700">
                          En stock ({v.stockTotal})
                        </span>
                      ) : (
                        <span className="text-red-700">Sin stock</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">{formatARS(v.price)}</div>
                    {v.compareAt && v.compareAt > v.price && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatARS(v.compareAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/checkout"
              className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              Comprar
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}