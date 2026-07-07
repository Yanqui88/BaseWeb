import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/dist/client/link";
import { fetchTenantConfig } from "../layout";
import CheckoutForm from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Finalizar Compra - Guest Checkout",
  description: "Completa tu información de envío y realiza tu pago de forma rápida y segura.",
};

export default async function CheckoutPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const config = await fetchTenantConfig(host);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0c0f1e] via-[#05060f] to-[#140b24] text-slate-100 overflow-hidden font-sans">
      {/* Elementos de fondo Premium / Glowing Blur Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] -z-10 animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-600/10 blur-[120px] -z-10 animate-pulse pointer-events-none" />
      
      {/* Header / Barra de Navegación */}
      <header className="border-b border-white/[0.06] bg-slate-950/20 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 group text-slate-300 hover:text-white transition-colors duration-300 cursor-pointer"
          >
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-indigo-300">
              {config.tenantName}
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold text-emerald-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CONEXIÓN SEGURA SSL
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12 relative z-10">
        {/* Breadcrumb / Regresar */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors duration-200 cursor-pointer">
            Inicio
          </Link>
          <span>/</span>
          <span className="text-slate-300">Checkout</span>
        </div>

        {/* Encabezado */}
        <div className="mb-10 text-left">
          <span className="inline-flex rounded-full bg-blue-500/10 border border-blue-500/25 px-3 py-1 text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">
            Paso Final
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Finalizar Compra
          </h1>
          <p className="mt-2 text-slate-400 text-sm md:text-base max-w-2xl">
            Completa tus datos de entrega y procesa tu orden de forma segura en un solo clic. No necesitas registrarte.
          </p>
        </div>

        {/* Formulario */}
        <CheckoutForm />
      </main>

      {/* Footer Sutil */}
      <footer className="border-t border-white/[0.04] bg-slate-950/40 py-6 mt-16 text-center text-xs text-slate-600">
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} {config.tenantName}. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer transition-colors duration-200">Términos de Servicio</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors duration-200">Políticas de Privacidad</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
