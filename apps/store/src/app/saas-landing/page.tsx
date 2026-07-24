import RegistrationForm from "@/components/RegistrationForm";

export default function SaaSPage() {
  return (
    <main className="space-y-24 pb-20 font-sans overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* HERO SECTION WITH EMBEDDED ONBOARDING FORM */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 lg:pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headlines & Benefits */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                  SaaS Multi-tenant • 30 Días de Prueba Gratis
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] font-outfit">
                Lanza tu Tienda Online en <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Minutos</span> sin Código.
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                La plataforma de comercio electrónico diseñada para vender rápido. Obtén tu subdominio instantáneo, pasarela de pago Mercado Pago integrada y panel de administración en un solo lugar.
              </p>

              {/* Quick Feature Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                  <span>Sin comisiones por venta</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                  <span>Configuración en 3 simples pasos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                  <span>Pagos directos a tu cuenta de Mercado Pago</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                  <span>Seguridad de datos RLS por tienda</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <a
                  href="#comenzar"
                  className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-105 hover:shadow-indigo-500/50 active:scale-95 cursor-pointer group"
                >
                  <span>Comienza tu prueba de 30 días gratis</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </a>
                <a
                  href="#caracteristicas"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/60 px-6 py-4 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
                >
                  <span>Conocer Más</span>
                </a>
              </div>
            </div>

            {/* Right Column: Multistep Registration Form */}
            <div id="comenzar" className="lg:col-span-5 scroll-mt-28">
              <RegistrationForm className="border border-indigo-500/30 shadow-2xl shadow-indigo-500/20" />
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STATS STRIP */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800/80 bg-slate-950/40 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <div className="text-3xl font-black text-white font-outfit bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                +500
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiendas Creadas</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-white font-outfit bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                99.99%
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Disponibilidad / Uptime</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-white font-outfit bg-gradient-to-r from-pink-400 to-amber-400 bg-clip-text text-transparent">
                &lt; 1 sec
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo de Carga</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-white font-outfit bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                0%
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comisión por Venta</div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* FEATURES SECTION (GLASSMORPHISM CARDS) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section id="caracteristicas" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <span className="inline-flex rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-indigo-400">
            Poder Tecnológico
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-outfit">
            Diseñado para que te enfoques únicamente en vender
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Nuestra arquitectura multi-tenant combina velocidad, seguridad bancaria y flexibilidad total para escalar tu negocio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-indigo-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              ⚡
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Onboarding Self-service</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crea tu tienda con solo elegir tu nombre y correo. Tu subdominio personalizado estará listo para recibir clientes al instante.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-purple-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              🌐
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Multi-tenant por Host</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Soporte nativo para subdominios y dominios personalizados con SSL automático. Cada tienda funciona como una plataforma independiente.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-pink-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-pink-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              💳
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Mercado Pago Integrado</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cobra con tarjeta de crédito, débito, transferencia y dinero en cuenta directamente hacia tu usuario de Mercado Pago.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-emerald-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              🔒
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Seguridad RLS PostgreSQL</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Aislamiento estricto de datos a nivel de base de datos con Row-Level Security. Tus productos y clientes están 100% protegidos.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-amber-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              📦
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Gestión de Inventario</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Control de variantes de productos (talles, colores), stock por sucursal y cupones de descuento personalizables.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/50 hover:bg-slate-900/80 hover:-translate-y-1.5 shadow-xl hover:shadow-cyan-500/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-2xl mb-6 transition-transform duration-300 group-hover:scale-110">
              📈
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">Métricas en Tiempo Real</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Visualiza tus ventas diarias, órdenes completadas y productos más vendidos desde un panel intuitivo y veloz.
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* PRICING SECTION (SINGLE UNIFIED PLAN TABLE) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section id="planes" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <span className="inline-flex rounded-full bg-purple-500/10 border border-purple-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-purple-400">
            Precio Transparente
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-outfit">
            Un plan único sin sorpresas ni letras chicas
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Todo lo que necesitas para vender en línea por una tarifa mensual fija. Prueba gratis por 30 días.
          </p>
        </div>

        <div className="max-w-lg mx-auto relative">
          {/* Card glow container */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-xl animate-pulse pointer-events-none" />

          <div className="relative rounded-3xl border border-indigo-500/40 bg-slate-900/90 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-8">
            {/* Ribbon Badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-pink-500 px-3.5 py-1 rounded-full text-white">
                PLAN PRO • 30 DÍAS GRATIS
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sin contrato de permanencia
              </span>
            </div>

            {/* Price Display */}
            <div className="space-y-2 border-b border-slate-800 pb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white font-outfit">$29</span>
                <span className="text-sm font-semibold text-slate-400">/ mes</span>
              </div>
              <p className="text-xs text-slate-400">
                Primeros 30 días 100% gratuitos. Cancela en cualquier momento sin penalizaciones.
              </p>
            </div>

            {/* Features Included List */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Todo lo que incluye tu plan:
              </h4>
              <ul className="space-y-3 text-xs text-slate-300 font-medium">
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Tienda e-commerce completa con tu subdominio</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Productos e inventario ilimitados</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Cobros integrados con Mercado Pago sin comisiones extra</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Certificado de Seguridad SSL gratuito</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Calculadora de envíos y promociones por cupón</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
                  <span>Soporte técnico prioritario 24/7</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <a
              href="#comenzar"
              className="block w-full text-center rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.02] hover:opacity-95 active:scale-95 cursor-pointer"
            >
              Comienza tu prueba de 30 días gratis 🚀
            </a>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* FREQUENTLY ASKED QUESTIONS (FAQ) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight font-outfit">
            Preguntas Frecuentes
          </h2>
          <p className="text-sm text-slate-400">
            Resuelve tus dudas en segundos antes de comenzar.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-base font-bold text-white mb-2">¿Necesito ingresar mi tarjeta de crédito para registrarme?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No. Puedes crear tu tienda y disfrutar de los 30 días de prueba gratuita sin ingresar ningún método de pago.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-base font-bold text-white mb-2">¿Cómo recibo el dinero de mis ventas?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Los pagos realizados por tus clientes impactan directamente en tu propia cuenta de Mercado Pago en tiempo real.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-base font-bold text-white mb-2">¿Puedo usar mi propio dominio personalizado?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sí. Al registrarte se asigna automáticamente un subdominio, pero en cualquier momento puedes conectar tu propio dominio .com o local.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
