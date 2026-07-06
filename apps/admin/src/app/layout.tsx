import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-zinc-950 text-zinc-100 min-h-screen flex`}
      >
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 pl-64 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-10 flex items-center justify-between px-8 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60">
            <div className="flex items-center gap-4">
              {/* Context / Breadcrumb / Tenant Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tenant: </span>
                <span className="text-zinc-200 font-semibold">Acme Corporation</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Action buttons or search */}
              <div className="relative hidden md:block">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="w-64 pl-9 pr-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-300 placeholder-zinc-500 transition-all duration-300"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white transition-colors duration-200" aria-label="Notifications">
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            </div>
          </header>

          {/* Main content grid/layout */}
          <main className="flex-1 p-8 bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950 relative overflow-y-auto">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 left-10 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
