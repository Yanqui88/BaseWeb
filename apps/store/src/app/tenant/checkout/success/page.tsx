import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = {
  title: "¡Compra Confirmada! - Gracias por tu pedido",
  description: "Tu pedido ha sido procesado exitosamente. Te enviaremos los detalles por email.",
};

interface SuccessPageProps {
  searchParams: Promise<{
    payment_id?: string;
    status?: string;
    external_reference?: string;
    collection_status?: string;
  }>;
}

async function fetchTenantConfig(tenantDomain: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${apiUrl}/public/tenant/config`, {
      headers: {
        "x-tenant-domain": tenantDomain,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json() as {
      name?: string;
      whatsapp_phone?: string | null;
    };
  } catch {
    return null;
  }
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const orderId = params.external_reference ?? null;
  const paymentStatus = params.status ?? params.collection_status ?? "approved";
  const shortOrderId = orderId ? orderId.slice(-8).toUpperCase() : "N/A";
  const isApproved = paymentStatus === "approved";

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost";
  const tenantDomain = host.split(":")[0];
  const tenantConfig = await fetchTenantConfig(tenantDomain);
  const whatsappPhone = tenantConfig?.whatsapp_phone ?? null;
  const tenantName = tenantConfig?.name ?? "la tienda";

  const whatsappMessage = encodeURIComponent(
    `¡Hola ${tenantName}! 👋\n\nAcabo de realizar una compra.\n📦 Orden #${shortOrderId}\n\n¿Me pueden confirmar el estado del pedido? ¡Gracias!`
  );
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${whatsappMessage}`
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#0f0f2e] to-[#0a0a1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] text-center">

          <div className="mb-6 flex justify-center">
            {isApproved ? (
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping" />
                <svg className="h-12 w-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : (
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500/20">
                <svg className="h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2">
            {isApproved ? "¡Gracias por tu compra!" : "Pago en proceso"}
          </h1>
          <p className="text-slate-400 text-base mb-6">
            {isApproved
              ? "Tu pago fue procesado exitosamente. Te enviamos los detalles por email."
              : "Tu pago está siendo procesado. Te notificaremos cuando se confirme."}
          </p>

          {orderId && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Orden</span>
              <span className="text-sm font-mono text-white font-bold">#{shortOrderId}</span>
            </div>
          )}

          <div className="mb-8 flex justify-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              isApproved
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isApproved ? "bg-emerald-400" : "bg-yellow-400"}`} />
              {isApproved ? "Pago Aprobado" : "En Proceso"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Envío Pendiente
            </span>
          </div>

          <div className="border-t border-white/[0.06] mb-6" />

          <div className="flex flex-col gap-3">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] px-6 py-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,211,102,0.25)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] active:scale-[0.98]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Notificar por WhatsApp
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
              </a>
            )}

            <Link
              href="/"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-300 transition-all duration-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a la tienda
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed">
            Recibirás una confirmación en tu correo electrónico con los detalles del pedido y actualizaciones de envío.
          </p>
        </div>
      </div>
    </main>
  );
}
