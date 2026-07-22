import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AdminShell from "@/components/AdminShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MultiTenant SaaS - Panel de Administración",
  description: "Panel de administración y configuración de tenants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-zinc-950 text-zinc-100 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
