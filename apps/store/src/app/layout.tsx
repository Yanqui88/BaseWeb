import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VentaYa SaaS - Plataforma E-commerce Multi-tenant",
  description: "Crea tu tienda virtual en segundos con dominio propio, pagos integrados y gestión centralizada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark scroll-smooth">
      <body className="bg-[#0b0f19] text-slate-100 antialiased min-h-screen selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
