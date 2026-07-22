import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "VentaYa - Crea tu Tienda Online en Segundos | SaaS Multi-tenant",
  description: "La plataforma de e-commerce más rápida y potente. Vende productos físicos y digitales con tu propio dominio, pasarela Mercado Pago y panel de gestión sin comisiones extra.",
  keywords: ["saas ecommerce", "crear tienda online", "vender por internet", "multi-tenant", "mercado pago"],
};

export default function SaaSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.variable} ${outfit.variable} font-sans bg-[#080c16] text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white`}>
      {/* Dynamic Glowing Canvas Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-pink-500/10 blur-[130px]" />
        <div className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] rounded-full bg-purple-600/10 blur-[150px]" />
      </div>

      {/* SaaS Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#080c16]/80 backdrop-blur-xl transition-all">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* SaaS Brand Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl shadow-lg shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-105">
                V
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white font-outfit">
                  Venta<span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">Ya</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                  SaaS E-Commerce
                </span>
              </div>
            </Link>

            {/* Center Nav Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
              <a href="#caracteristicas" className="hover:text-white transition-colors">
                Características
              </a>
              <a href="#planes" className="hover:text-white transition-colors">
                Planes y Precios
              </a>
              <a href="#comenzar" className="hover:text-white transition-colors">
                Prueba Gratis
              </a>
              <a href="#faq" className="hover:text-white transition-colors">
                Preguntas Frecuentes
              </a>
            </nav>

            {/* Header Actions */}
            <div className="flex items-center gap-4">
              <a
                href={process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001/login"}
                className="hidden sm:inline-flex text-xs font-bold text-slate-300 hover:text-white px-4 py-2.5 rounded-xl border border-slate-700/80 hover:border-slate-600 bg-slate-900/50 transition-all"
              >
                Iniciar Sesión
              </a>
              <a
                href="#comenzar"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                <span>Crear mi Tienda</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
        {children}
      </div>

      {/* Premium Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060911] pt-16 pb-12 text-slate-400 text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 text-white font-extrabold text-lg">
                  V
                </div>
                <span className="text-lg font-black text-white font-outfit">VentaYa</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plataforma SaaS Multi-tenant de infraestructura de comercio electrónico en la nube. Diseñada para vendedores independientes, emprendedores y marcas en rápido crecimiento.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Producto</h4>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#caracteristicas" className="hover:text-white transition-colors">Características Generales</a></li>
                <li><a href="#planes" className="hover:text-white transition-colors">Planes y Tarifas</a></li>
                <li><a href="#comenzar" className="hover:text-white transition-colors">Onboarding Self-service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pasarelas de Pago</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Integraciones</h4>
              <ul className="space-y-2.5 text-xs">
                <li><span className="text-slate-300">Mercado Pago Checkout Pro</span></li>
                <li><span className="text-slate-300">PostgreSQL Native RLS</span></li>
                <li><span className="text-slate-300">Next.js 16 Multi-tenant</span></li>
                <li><span className="text-slate-300">Dominios SSL Automáticos</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Soporte y Seguridad</h4>
              <p className="text-xs text-slate-400 mb-3">
                ¿Tienes dudas sobre cómo configurar tu tienda?
              </p>
              <a
                href="mailto:soporte@ventaya.com"
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ✉️ contacto@ventaya.com
              </a>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} VentaYa SaaS Platform. Todos los derechos reservados.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacidad</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Términos del Servicio</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Seguridad RLS</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
