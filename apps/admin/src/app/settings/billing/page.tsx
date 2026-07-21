/**
 * @file page.tsx
 * @description Página de Estado de Suscripción SaaS – /settings/billing
 *
 * Hito 11 – Fase 5: Billing SaaS
 * ─────────────────────────────────────────────────────────────────────────────
 * Server Component que:
 *  1. Carga el estado de billing del tenant via Server Action.
 *  2. Muestra una tarjeta de estado con diseño Glassmorphism premium.
 *  3. Renderiza botón de renovación que lanza createPreferenceAndRedirectAction.
 *
 * Estados visuales:
 *  - 'trial'       → Badge azul, días restantes del trial, CTA de upgrade.
 *  - 'active'      → Badge esmeralda, fecha de vencimiento, CTA de renovación.
 *  - 'grace_period'→ Badge ámbar, advertencia, CTA urgente.
 *  - 'suspended'   → Badge rojo, mensaje de suspensión, CTA de reactivación.
 *  - 'unknown'     → Badge gris, mensaje genérico.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { Metadata } from 'next';
import {
  getBillingStatusAction,
  createPreferenceAndRedirectAction,
  BillingStatus,
} from './billing.actions';

// ──────────────────────────────────────────────────────────────────────────
// SEO
// ──────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Facturación y Suscripción | Panel de Administración',
  description:
    'Administra el estado de tu suscripción SaaS, revisa los días restantes y renueva tu plan mensual.',
};

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr));
}

type StatusConfig = {
  label: string;
  badgeClass: string;
  badgeDot: string;
  accentGradient: string;
  glowColor: string;
  icon: React.ReactNode;
  description: string;
  urgency: 'none' | 'low' | 'medium' | 'high';
};

function getStatusConfig(status: BillingStatus['status'], daysRemaining: number | null): StatusConfig {
  switch (status) {
    case 'active':
      return {
        label: 'Activo',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        badgeDot: 'bg-emerald-400',
        accentGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
        glowColor: 'shadow-emerald-500/10',
        icon: (
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        description: 'Tu suscripción está activa. Tienes acceso completo a todas las funcionalidades de la plataforma.',
        urgency: 'none',
      };

    case 'trial':
      return {
        label: 'Período de Prueba',
        badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        badgeDot: 'bg-blue-400 animate-pulse',
        accentGradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
        glowColor: 'shadow-blue-500/10',
        icon: (
          <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        description:
          daysRemaining !== null && daysRemaining <= 7
            ? `¡Tu prueba vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}! Activa tu plan para no perder el acceso.`
            : 'Estás en período de prueba gratuita. Activa tu plan para continuar sin interrupciones.',
        urgency: daysRemaining !== null && daysRemaining <= 7 ? 'medium' : 'low',
      };

    case 'grace_period':
      return {
        label: 'Período de Gracia',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        badgeDot: 'bg-amber-400 animate-pulse',
        accentGradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
        glowColor: 'shadow-amber-500/10',
        icon: (
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ),
        description: '⚠️ Tu suscripción venció. Tienes un período de gracia activo. Renueva ahora para evitar la suspensión.',
        urgency: 'high',
      };

    case 'suspended':
      return {
        label: 'Suspendido',
        badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
        badgeDot: 'bg-red-500',
        accentGradient: 'from-red-500/20 via-rose-500/10 to-transparent',
        glowColor: 'shadow-red-500/10',
        icon: (
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        description: '🚨 Tu tienda está suspendida. Renueva tu suscripción para reactivar el acceso a todos tus clientes.',
        urgency: 'high',
      };

    default:
      return {
        label: 'Desconocido',
        badgeClass: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
        badgeDot: 'bg-zinc-500',
        accentGradient: 'from-zinc-700/20 to-transparent',
        glowColor: 'shadow-zinc-700/10',
        icon: (
          <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        ),
        description: 'No se pudo determinar el estado de tu suscripción. Contacta al soporte.',
        urgency: 'none',
      };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (Server Component)
// ──────────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const returnStatus = params?.status;

  // Cargar estado de billing desde el backend
  const billingRes = await getBillingStatusAction();
  const billing = billingRes.data ?? {
    status: 'unknown' as BillingStatus['status'],
    trial_ends_at: null,
    updated_at: null,
    days_remaining: null,
  };

  const statusConfig = getStatusConfig(billing.status, billing.days_remaining);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Facturación y Suscripción
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Administra el plan de tu tienda y accede al historial de pagos.
        </p>
      </div>

      {/* ── Banner de retorno de MP ──────────────────────────────────────── */}
      {returnStatus === 'success' && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm font-medium animate-fade-in"
        >
          <svg className="w-5 h-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ¡Pago recibido con éxito! Tu suscripción se está activando. Puede tardar unos segundos en actualizarse.
        </div>
      )}

      {returnStatus === 'failure' && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm font-medium"
        >
          <svg className="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          El pago no pudo completarse. Podés reintentar cuando quieras.
        </div>
      )}

      {returnStatus === 'pending' && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm font-medium"
        >
          <svg className="w-5 h-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tu pago está pendiente de confirmación. Te avisaremos cuando se acredite.
        </div>
      )}

      {returnStatus === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm font-medium"
        >
          <svg className="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          No se pudo generar el link de pago. Por favor intentá de nuevo o contacta al soporte.
        </div>
      )}

      {/* ── Tarjeta Principal: Estado de Suscripción (Glassmorphism) ─────── */}
      <div
        className={`
          relative overflow-hidden rounded-3xl
          bg-zinc-900/60 backdrop-blur-xl
          border border-zinc-800/60
          shadow-2xl ${statusConfig.glowColor}
          p-8
        `}
      >
        {/* Gradiente decorativo superior */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${statusConfig.accentGradient} pointer-events-none`}
        />
        {/* Orbe decorativo */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Header de la tarjeta */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 backdrop-blur-sm">
                {statusConfig.icon}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                  Estado de la Suscripción
                </p>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusConfig.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.badgeDot}`} />
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Precio del plan */}
            <div className="text-right">
              <div className="text-3xl font-black text-white tracking-tight">
                $29
                <span className="text-base font-normal text-zinc-400">/mes</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">USD · Plan Profesional</p>
            </div>
          </div>

          {/* Descripción del estado */}
          <p className="text-sm text-zinc-300 leading-relaxed">
            {statusConfig.description}
          </p>

          {/* Detalles de billing */}
          <div className="grid grid-cols-2 gap-4">
            {/* Días restantes */}
            {billing.days_remaining !== null && (
              <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-700/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Días Restantes
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-4xl font-black tabular-nums ${
                      billing.days_remaining <= 7
                        ? 'text-amber-400'
                        : billing.days_remaining <= 3
                        ? 'text-red-400'
                        : 'text-white'
                    }`}
                  >
                    {billing.days_remaining}
                  </span>
                  <span className="text-sm text-zinc-400">días</span>
                </div>
                {/* Barra de progreso */}
                <div className="mt-3 h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      billing.days_remaining <= 7
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (billing.days_remaining / 30) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Fecha de vencimiento */}
            <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-700/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                {billing.status === 'active' ? 'Próxima Renovación' : 'Vence el'}
              </p>
              <p className="text-lg font-bold text-white mt-1 leading-tight">
                {formatDate(billing.trial_ends_at)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {billing.status === 'active'
                  ? 'Requiere renovación manual'
                  : 'Fecha límite del período actual'}
              </p>
            </div>
          </div>

          {/* Separador */}
          <div className="h-px bg-zinc-800/60" />

          {/* ── CTA: Botón de Renovación ──────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <form action={createPreferenceAndRedirectAction}>
              <button
                id="btn-renovar-suscripcion"
                type="submit"
                className="
                  group relative w-full overflow-hidden
                  flex items-center justify-center gap-3
                  px-8 py-5
                  bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600
                  hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500
                  active:scale-[0.98]
                  text-white text-lg font-black tracking-wide
                  rounded-2xl
                  shadow-xl shadow-indigo-600/30
                  hover:shadow-2xl hover:shadow-indigo-500/40
                  transition-all duration-300 ease-out
                  cursor-pointer
                "
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none" />

                {/* Ícono de Mercado Pago */}
                <svg
                  className="w-6 h-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>

                <span>Renovar Suscripción · $29/mes</span>

                {/* Flecha animada */}
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500">
              🔒 Pago seguro procesado por{' '}
              <span className="text-zinc-400 font-semibold">Mercado Pago</span>.
              Tu información financiera nunca toca nuestros servidores.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tarjeta de Beneficios del Plan ──────────────────────────────── */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
          Plan Profesional · Incluye
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '🛍️', text: 'Catálogo ilimitado de productos' },
            { icon: '📦', text: 'Gestión completa de órdenes' },
            { icon: '🎫', text: 'Cupones y descuentos personalizados' },
            { icon: '📊', text: 'Analytics y métricas en tiempo real' },
            { icon: '🚚', text: 'Integración de logística y envíos' },
            { icon: '💳', text: 'Mercado Pago Checkout Pro integrado' },
            { icon: '🔒', text: 'SSL y seguridad enterprise' },
            { icon: '⚡', text: 'Soporte técnico prioritario' },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-2.5 text-sm text-zinc-300"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
