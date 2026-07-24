"use client";

import { useState, useEffect, useRef } from "react";

interface RegistrationFormProps {
  onSuccess?: () => void;
  className?: string;
}

export default function RegistrationForm({ className = "" }: RegistrationFormProps) {
  // Step State (1: Store Name & Domain, 2: Email & Password, 3: Creating/Success)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [storeName, setStoreName] = useState("");
  const [domain, setDomain] = useState("");
  const [isManualDomain, setIsManualDomain] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Domain Check UI State
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainStatusText, setDomainStatusText] = useState("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounce Ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to slugify store name
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W_]+(?!\s*$)/g, "-") // Replace spaces and special chars with hyphens
      .replace(/[^a-z0-9-]/g, "") // Remove all non-alphanumeric chars except hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
  };

  // Handle store name change -> auto update domain slug if not manually touched
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStoreName(val);
    if (!isManualDomain) {
      const generatedSlug = slugify(val);
      setDomain(generatedSlug);
    }
  };

  // Handle domain slug change
  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualDomain(true);
    const cleaned = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
    setDomain(cleaned);
  };

  // Debounced domain availability check
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!domain || domain.length < 3) {
      setDomainAvailable(null);
      setIsCheckingDomain(false);
      setDomainStatusText(domain ? "El subdominio debe tener al menos 3 caracteres." : "");
      return;
    }

    setIsCheckingDomain(true);
    setDomainAvailable(null);
    setDomainStatusText("Verificando disponibilidad...");

    debounceRef.current = setTimeout(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
        const res = await fetch(`${apiUrl}/saas/check-domain/${encodeURIComponent(domain)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          setDomainAvailable(data.available);
          setDomainStatusText(
            data.available
              ? `¡Dominio ${data.domain} disponible!`
              : `El subdominio '${data.domain}' ya está registrado.`
          );
        } else {
          // Si la respuesta no es OK pero el slug tiene formato válido, permitimos continuar
          setDomainAvailable(true);
          setDomainStatusText("Dominio válido para registro.");
        }
      } catch (err) {
        console.error("Domain check error:", err);
        // En caso de estar en desarrollo sin API activa, permitimos continuar con la validación de formato
        setDomainAvailable(true);
        setDomainStatusText("Dominio formateado correctamente.");
      } finally {
        setIsCheckingDomain(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [domain]);

  // Handle form submit (POST /saas/register)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (storeName.trim().length >= 2 && domain.length >= 3 && !isCheckingDomain) {
        setStep(2);
      }
      return;
    }

    if (step === 2) {
      if (!email || !password || password.length < 8) {
        setSubmitError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
        const res = await fetch(`${apiUrl}/saas/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            storeName: storeName.trim(),
            domain: domain.trim(),
            email: email.trim(),
            password: password,
          }),
        });

        const data = await res.json();

        if (res.ok || res.status === 201) {
          setStep(3);
          // Redirect to Admin panel after 2.5 seconds
          setTimeout(() => {
            const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001/login";
            window.location.href = adminUrl;
          }, 2500);
        } else {
          setSubmitError(data.message || "Error al registrar la tienda. Intenta nuevamente.");
        }
      } catch (err) {
        console.error("Registration error:", err);
        setSubmitError("Error de conexión con el servidor de registro.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-slate-900/80 p-6 md:p-8 backdrop-blur-2xl shadow-2xl shadow-indigo-500/10 ${className}`}>
      {/* Decorative Glow elements */}
      <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-extrabold text-sm shadow-md shadow-indigo-500/20">
              {step === 3 ? "✓" : step}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {step === 1 && "Elige el nombre de tu tienda"}
                {step === 2 && "Tus datos de acceso"}
                {step === 3 && "¡Tienda creada exitosamente!"}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 1 && "Paso 1 de 2 • Configuración inicial del subdominio"}
                {step === 2 && "Paso 2 de 2 • Credenciales del Administrador"}
                {step === 3 && "Redirigiéndote a tu Panel de Control..."}
              </p>
            </div>
          </div>

          {/* Progress Pill Bar */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-full border border-slate-700/50">
            <div className={`h-2.5 w-8 rounded-full transition-all duration-300 ${step >= 1 ? "bg-indigo-500 shadow-sm shadow-indigo-500/50" : "bg-slate-700"}`} />
            <div className={`h-2.5 w-8 rounded-full transition-all duration-300 ${step >= 2 ? "bg-indigo-500 shadow-sm shadow-indigo-500/50" : "bg-slate-700"}`} />
            <div className={`h-2.5 w-8 rounded-full transition-all duration-300 ${step === 3 ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-slate-700"}`} />
          </div>
        </div>

        {/* STEP 1: Store Name & Domain */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="storeName" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nombre de tu Tienda o Marca *
              </label>
              <input
                id="storeName"
                type="text"
                required
                value={storeName}
                onChange={handleStoreNameChange}
                placeholder="Ej. Mi Tienda Increíble"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="domain" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Dominio o Subdominio de tu Tienda *
              </label>
              <div className="relative flex items-center">
                <input
                  id="domain"
                  type="text"
                  required
                  value={domain}
                  onChange={handleDomainChange}
                  placeholder="mi-tienda"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-4 pr-36 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 pointer-events-none select-none">
                  .localhost:3000
                </span>
              </div>

              {/* Realtime Availability Badge */}
              {domain && (
                <div className="mt-2.5 flex items-center gap-2">
                  {isCheckingDomain ? (
                    <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>{domainStatusText}</span>
                    </div>
                  ) : domainAvailable === true ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                      <span className="text-sm">✅</span>
                      <span>{domainStatusText}</span>
                    </div>
                  ) : domainAvailable === false ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400 border border-rose-500/20">
                      <span className="text-sm">❌</span>
                      <span>{domainStatusText}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{domainStatusText}</span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={storeName.trim().length < 2 || domainAvailable !== true || isCheckingDomain}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:opacity-95 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Continuar con mis datos</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </form>
        )}

        {/* STEP 2: Email & Password */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 font-semibold animate-shake">
                ⚠️ {submitError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Correo Electrónico del Administrador *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mitienda.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Contraseña de Acceso * (Mínimo 8 caracteres)
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3 text-xs text-slate-400 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Tienda:</span> {storeName}
              </div>
              <div className="font-mono text-indigo-300">
                {domain}.localhost:3000
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
              >
                ← Volver
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email || password.length < 8}
                className="w-2/3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:opacity-95 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creando tu tienda...
                  </span>
                ) : (
                  <>
                    <span>Crear mi tienda</span>
                    <span className="transition-transform group-hover:translate-x-1">🚀</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success & Redirection */}
        {step === 3 && (
          <div className="py-8 text-center space-y-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xl shadow-emerald-500/20 animate-bounce">
              <span className="text-4xl">🎉</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-2xl font-black text-white">¡Felicitaciones!</h4>
              <p className="text-sm text-slate-300 max-w-sm mx-auto">
                Tu tienda <span className="font-bold text-indigo-400">{storeName}</span> ha sido creada con éxito.
              </p>
            </div>
            <div className="pt-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                <svg className="h-4 w-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Redirigiendo a tu Panel de Control...
              </div>
              <a
                href={process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001/login"}
                className="text-xs text-indigo-400 underline hover:text-indigo-300 mt-2"
              >
                ¿No fuiste redirigido? Haz clic aquí.
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
