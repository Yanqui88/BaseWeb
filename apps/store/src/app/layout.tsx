import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cache } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const fetchTenantConfig = cache(async (host: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${apiUrl}/public/tenant/config`, {
      headers: {
        "x-tenant-domain": host,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return {
        id: "",
        name: "Mi Tienda Demo",
        tenantName: "Mi Tienda Demo",
        domain: host,
        primary_color: "#3b82f6",
        primaryColor: "#3b82f6",
        secondary_color: null,
        logo_url: null,
        whatsapp_phone: null,
        seo_title: null,
        seo_description: null,
        seo_keywords: null,
        seo_og_image: null,
      };
    }
    const data = await res.json();
    return {
      id: data.id || "",
      name: data.name || "Mi Tienda Demo",
      tenantName: data.name || "Mi Tienda Demo",
      domain: data.domain || host,
      primary_color: data.primary_color || "#3b82f6",
      primaryColor: data.primary_color || "#3b82f6",
      secondary_color: data.secondary_color || null,
      logo_url: data.logo_url || null,
      whatsapp_phone: data.whatsapp_phone || null,
      seo_title: data.seo_title || null,
      seo_description: data.seo_description || null,
      seo_keywords: data.seo_keywords || null,
      seo_og_image: data.seo_og_image || null,
    };
  } catch (error) {
    console.error("Error fetching tenant config:", error);
    return {
      id: "",
      name: "Mi Tienda Demo",
      tenantName: "Mi Tienda Demo",
      domain: host,
      primary_color: "#3b82f6",
      primaryColor: "#3b82f6",
      secondary_color: null,
      logo_url: null,
      whatsapp_phone: null,
      seo_title: null,
      seo_description: null,
      seo_keywords: null,
      seo_og_image: null,
    };
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const config = await fetchTenantConfig(host);

  const fallbackTitle = config.name || "Mi Tienda Demo";
  const fallbackDescription = `Bienvenido a ${fallbackTitle}`;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  const ogImageUrl = config.seo_og_image
    ? (config.seo_og_image.startsWith("/uploads/") ? `${apiUrl}${config.seo_og_image}` : config.seo_og_image)
    : undefined;

  return {
    title: config.seo_title || fallbackTitle,
    description: config.seo_description || fallbackDescription,
    keywords: config.seo_keywords || undefined,
    openGraph: ogImageUrl
      ? {
          title: config.seo_title || fallbackTitle,
          description: config.seo_description || fallbackDescription,
          images: [{ url: ogImageUrl }],
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const config = await fetchTenantConfig(host);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --color-primary: ${config.primary_color}; }`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
