import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  // En producción usamos https
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

  let products: Array<{ slug: string; updated_at: string }> = [];

  try {
    const res = await fetch(`${apiUrl}/public/tenant/sitemap`, {
      headers: {
        "x-tenant-domain": host,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      products = await res.json();
    }
  } catch (error) {
    console.error("Error fetching sitemap products:", error);
  }

  const currentDate = new Date().toISOString();

  const xmlItems = products
    .map((prod) => {
      let lastMod = currentDate;
      try {
        if (prod.updated_at) {
          lastMod = new Date(prod.updated_at).toISOString();
        }
      } catch {
        lastMod = currentDate;
      }
      return `  <url>
    <loc>${baseUrl}/product/${prod.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${xmlItems}
</urlset>`;

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
