type Banner = {
  desktopImageUrl: string;
  mobileImageUrl: string;
  href?: string | null;
  alt?: string | null;
  badge?: string | null;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  isActive?: boolean;
};

async function getBanner(): Promise<Banner | null> {
  const res = await fetch("http://localhost:4000/admin/default/home/banner", {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function BannerPage() {
  const banner = await getBanner();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Admin · Banner</h1>
      <p className="mt-2 text-sm text-gray-600">
        Editá el banner principal. (MVP: 1 banner)
      </p>

      <form
        className="mt-6 space-y-4"
        action="/banner/save"
        method="post"
      >
        <input type="hidden" name="isActive" defaultValue={(banner?.isActive ?? true) ? "true" : "false"} />

        {[
          ["desktopImageUrl", "Desktop Image URL"],
          ["mobileImageUrl", "Mobile Image URL"],
          ["href", "Link (href)"],
          ["alt", "Alt text"],
          ["badge", "Badge"],
          ["title", "Title"],
          ["subtitle", "Subtitle"],
          ["buttonText", "Button text"],
        ].map(([name, label]) => (
          <div key={name}>
            <label className="block text-sm font-medium">{label}</label>
            <input
              name={name}
              defaultValue={(banner as any)?.[name] ?? ""}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
        ))}

        <button className="rounded-xl bg-black px-4 py-2 text-white">
          Guardar
        </button>
      </form>

      {banner?.desktopImageUrl && (
        <div className="mt-8">
          <div className="text-sm font-medium">Preview (desktop):</div>
          <img
            src={banner.desktopImageUrl}
            className="mt-2 w-full rounded-2xl border object-cover"
            alt="preview"
          />
        </div>
      )}
    </main>
  );
}