'use client';

import React, { useState } from 'react';

interface VisualSettings {
  domain: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<VisualSettings>({
    domain: 'acme.store.com',
    primary_color: '#6366f1', // Indigo 500
    secondary_color: '#10b981', // Emerald 500
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // Abstract elegant logo placeholder
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Mock API call
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Configuración Visual</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Personaliza la identidad visual y el dominio personalizado de tu tienda en modo marca blanca.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Aspecto Visual
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Domain Input */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="domain" className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Dominio Personalizado
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 text-sm">
                    https://
                  </div>
                  <input
                    type="text"
                    id="domain"
                    name="domain"
                    value={settings.domain}
                    onChange={handleChange}
                    className="w-full pl-18 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                    placeholder="tienda.tudominio.com"
                    required
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  Asegúrate de apuntar tu registro CNAME a nuestros servidores.
                </p>
              </div>

              {/* Logo URL Input */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="logo_url" className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  URL del Logotipo
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="logo_url"
                    name="logo_url"
                    value={settings.logo_url}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                    placeholder="https://ejemplo.com/mi-logo.png"
                    required
                  />
                </div>
              </div>

              {/* Primary Color Input */}
              <div className="space-y-2">
                <label htmlFor="primary_color" className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Color Primario
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="primary_color"
                      name="primary_color"
                      value={settings.primary_color}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-650 transition-all duration-200"
                      placeholder="#4f46e5"
                      required
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 text-sm">
                      #
                    </div>
                  </div>
                  <input
                    type="color"
                    value={settings.primary_color.startsWith('#') ? settings.primary_color : `#${settings.primary_color}`}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-11 h-11 p-1 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Secondary Color Input */}
              <div className="space-y-2">
                <label htmlFor="secondary_color" className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Color Secundario
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="secondary_color"
                      name="secondary_color"
                      value={settings.secondary_color}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-650 transition-all duration-200"
                      placeholder="#06b6d4"
                      required
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 text-sm">
                      #
                    </div>
                  </div>
                  <input
                    type="color"
                    value={settings.secondary_color.startsWith('#') ? settings.secondary_color : `#${settings.secondary_color}`}
                    onChange={(e) => setSettings(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="w-11 h-11 p-1 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-250"
              >
                Descartar Cambios
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="relative inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 active:scale-98 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-md shadow-indigo-600/10 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </>
                ) : saveSuccess ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    ¡Guardado!
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Vista Previa
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                En vivo
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Así es como verán tus clientes la interfaz principal del e-commerce.
            </p>
          </div>

          {/* Mini E-commerce Layout Preview */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 flex flex-col aspect-video shadow-2xl relative group">
            {/* Browser Header Bar */}
            <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 max-w-[200px] mx-auto bg-zinc-950 border border-zinc-800/80 rounded-md py-0.5 px-2 text-[10px] text-zinc-400 text-center truncate">
                {settings.domain || 'sin-dominio.com'}
              </div>
            </div>

            {/* Storefront Layout */}
            <div className="flex-1 flex flex-col bg-zinc-950 p-3 text-white">
              {/* Store Header */}
              <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                <div className="flex items-center gap-1.5">
                  {settings.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={settings.logo_url} 
                      alt="Logo Preview" 
                      className="w-5 h-5 rounded-md object-cover shadow-sm bg-zinc-800" 
                      onError={(e) => {
                        // Fallback icon on error
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="text-[11px] font-bold tracking-tight text-white">STORE</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-6 h-1 rounded" style={{ backgroundColor: settings.primary_color }} />
                  <span className="w-6 h-1 rounded" style={{ backgroundColor: settings.secondary_color }} />
                </div>
              </div>

              {/* Store Hero section */}
              <div className="flex-1 flex flex-col justify-center items-center text-center p-2 space-y-2">
                <div 
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-md shadow-black/20 transition-all duration-300 transform group-hover:-translate-y-0.5" 
                  style={{ backgroundColor: settings.primary_color }}
                >
                  Colección de Verano
                </div>
                <p className="text-[8px] text-zinc-400 max-w-[160px]">
                  Descubre los productos seleccionados para ti.
                </p>
                <div 
                  className="w-16 h-3 rounded-full text-[6px] flex items-center justify-center font-medium border transition-colors duration-300"
                  style={{ 
                    borderColor: settings.secondary_color,
                    color: settings.secondary_color
                  }}
                >
                  Ver Catálogo
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines info */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide block">Instrucciones de DNS</span>
            <p className="text-xs text-zinc-500 leading-normal">
              Para validar tu dominio, añade un registro <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded text-[10px]">CNAME</code> apuntando a <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded text-[10px]">cname.multitenant-saas.com</code> en tu proveedor de DNS. La propagación puede tardar hasta 24 horas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
