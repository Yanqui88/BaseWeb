'use client';

import React, { useState, useEffect } from 'react';
import {
  getTenantConfigAction,
  updateTenantSeoAction,
  TenantConfigData
} from './settings.actions';

interface SettingsState {
  id: string;
  name: string;
  domain: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  whatsapp_phone: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'visual' | 'seo'>('visual');
  const [config, setConfig] = useState<SettingsState>({
    id: '',
    name: 'Mi Tienda Demo',
    domain: 'acme.store.com',
    primary_color: '#6366f1',
    secondary_color: '#10b981',
    logo_url: '',
    whatsapp_phone: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    seoOgImage: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG || 'default';

  useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      const res = await getTenantConfigAction();
      if (res.success && res.data) {
        setConfig({
          id: res.data.id || '',
          name: res.data.name || '',
          domain: res.data.domain || '',
          primary_color: res.data.primary_color || '#6366f1',
          secondary_color: res.data.secondary_color || '#10b981',
          logo_url: res.data.logo_url || '',
          whatsapp_phone: res.data.whatsapp_phone || '',
          seoTitle: res.data.seo_title || '', // Map backend snake_case to frontend camelCase
          seoDescription: res.data.seo_description || '',
          seoKeywords: res.data.seo_keywords || '',
          seoOgImage: res.data.seo_og_image || '',
        });
      } else {
        setError('No se pudo cargar la configuración del tenant.');
      }
      setIsLoading(false);
    }
    loadConfig();
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/admin/${tenant}/uploads`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Error al subir la imagen');
      }

      const json = await res.json() as { url: string };
      setConfig((prev) => ({ ...prev, seoOgImage: json.url }));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const res = await updateTenantSeoAction({
      seoTitle: config.seoTitle || null,
      seoDescription: config.seoDescription || null,
      seoKeywords: config.seoKeywords || null,
      seoOgImage: config.seoOgImage || null,
    });

    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setError('Error al actualizar la configuración SEO.');
    }
  };
  const colorPresets = [
    { name: 'Índigo Moderno', primary: '#6366f1', secondary: '#10b981' },
    { name: 'Esmeralda', primary: '#059669', secondary: '#3b82f6' },
    { name: 'Negro & Oro', primary: '#18181b', secondary: '#d97706' },
    { name: 'Cyberpunk', primary: '#d946ef', secondary: '#06b6d4' },
    { name: 'Lavanda', primary: '#8b5cf6', secondary: '#f43f5e' },
  ];

  const handleApplyPreset = (primary: string, secondary: string) => {
    setConfig((prev) => ({ ...prev, primary_color: primary, secondary_color: secondary }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/admin/${tenant}/uploads`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Error al subir el logotipo');
      }

      const json = await res.json() as { url: string };
      setConfig((prev) => ({ ...prev, logo_url: json.url }));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al subir el logotipo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveVisual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    // Simulate API call for Visual settings (since backend SQL shouldn't be altered in this phase)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // We save settings in localStorage so that we persist visual modifications locally in the client
    localStorage.setItem('tenant_visual_config', JSON.stringify({
      primary_color: config.primary_color,
      secondary_color: config.secondary_color,
      logo_url: config.logo_url,
      name: config.name,
    }));

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  function resolveImageUrl(url?: string | null) {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/uploads/')) return `${apiUrl}${trimmed}`;
    return trimmed;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Configuración General</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Personaliza la identidad visual, el dominio personalizado y la optimización SEO de tu tienda.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-4">
        <button
          onClick={() => setActiveTab('visual')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition-all duration-200 ${
            activeTab === 'visual'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Aspecto Visual
        </button>
        <button
          onClick={() => setActiveTab('seo')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition-all duration-200 ${
            activeTab === 'seo'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          SEO y Posicionamiento
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {activeTab === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Container */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
            
            <form onSubmit={handleSaveVisual} className="space-y-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Aspecto Visual
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Name Input */}
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Nombre del Tenant / Tienda
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={config.name}
                    onChange={(e) => {
                      setConfig((prev) => ({ ...prev, name: e.target.value }));
                      if (saveSuccess) setSaveSuccess(false);
                    }}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                  />
                </div>

                {/* Domain Input */}
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="domain" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
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
                      value={config.domain}
                      disabled
                      className="w-full pl-18 pr-4 py-2.5 bg-zinc-950/40 border border-zinc-800/60 rounded-xl text-sm text-zinc-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    El dominio de producción no es editable directamente por motivos de seguridad SSL.
                  </p>
                </div>

                {/* Logo Upload Input */}
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Logotipo de la Tienda
                  </label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      id="logo_url"
                      name="logo_url"
                      value={config.logo_url || ''}
                      onChange={(e) => {
                        setConfig((prev) => ({ ...prev, logo_url: e.target.value }));
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                      placeholder="https://ejemplo.com/logo.png o sube un archivo"
                    />
                    <label className="relative cursor-pointer flex items-center justify-center px-5 py-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 active:scale-98 text-zinc-300 text-sm font-semibold rounded-xl transition-all duration-200 shadow-md">
                      {uploadingImage ? 'Subiendo...' : 'Subir Logotipo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadLogo}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Primary Color Input */}
                <div className="space-y-2">
                  <label htmlFor="primary_color" className="block text-xs font-semibold uppercase tracking-wider text-zinc-405 text-zinc-400">
                    Color Primario
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="primary_color"
                        name="primary_color"
                        value={config.primary_color || ''}
                        onChange={(e) => {
                          setConfig((prev) => ({ ...prev, primary_color: e.target.value }));
                          if (saveSuccess) setSaveSuccess(false);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                      />
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 text-sm">
                        #
                      </div>
                    </div>
                    <label className="relative w-11 h-11 bg-zinc-950 border border-zinc-850 rounded-xl cursor-pointer overflow-hidden active:scale-95 transition-all">
                      <input
                        type="color"
                        value={config.primary_color && config.primary_color.startsWith('#') ? config.primary_color : '#6366f1'}
                        onChange={(e) => {
                          setConfig((prev) => ({ ...prev, primary_color: e.target.value }));
                          if (saveSuccess) setSaveSuccess(false);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div
                        className="w-full h-full rounded-lg"
                        style={{ backgroundColor: config.primary_color || '#6366f1' }}
                      />
                    </label>
                  </div>
                </div>

                {/* Secondary Color Input */}
                <div className="space-y-2">
                  <label htmlFor="secondary_color" className="block text-xs font-semibold uppercase tracking-wider text-zinc-405 text-zinc-400">
                    Color Secundario
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="secondary_color"
                        name="secondary_color"
                        value={config.secondary_color || ''}
                        onChange={(e) => {
                          setConfig((prev) => ({ ...prev, secondary_color: e.target.value }));
                          if (saveSuccess) setSaveSuccess(false);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white transition-all duration-200"
                      />
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 text-sm">
                        #
                      </div>
                    </div>
                    <label className="relative w-11 h-11 bg-zinc-950 border border-zinc-850 rounded-xl cursor-pointer overflow-hidden active:scale-95 transition-all">
                      <input
                        type="color"
                        value={config.secondary_color && config.secondary_color.startsWith('#') ? config.secondary_color : '#10b981'}
                        onChange={(e) => {
                          setConfig((prev) => ({ ...prev, secondary_color: e.target.value }));
                          if (saveSuccess) setSaveSuccess(false);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div
                        className="w-full h-full rounded-lg"
                        style={{ backgroundColor: config.secondary_color || '#10b981' }}
                      />
                    </label>
                  </div>
                </div>

                {/* Palettes Preset Picker */}
                <div className="space-y-2.5 md:col-span-2 border-t border-zinc-800/80 pt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Paletas Recomendadas (Presets)
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleApplyPreset(preset.primary, preset.secondary)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-sm"
                      >
                        <span className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <span className="w-3.5 h-3.5 rounded-full -ml-1.5" style={{ backgroundColor: preset.secondary }} />
                        </span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="relative inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 active:scale-98 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-md shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Guardando apariencia...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      ¡Apariencia Guardada!
                    </>
                  ) : (
                    'Guardar Apariencia'
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
                  {config.domain || 'sin-dominio.com'}
                </div>
              </div>

              {/* Storefront Layout */}
              <div className="flex-1 flex flex-col bg-zinc-950 p-3 text-white justify-between">
                {/* Store Header */}
                <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                  <div className="flex items-center gap-1.5">
                    {config.logo_url ? (
                      <img 
                        src={resolveImageUrl(config.logo_url)} 
                        alt="Logo Preview" 
                        className="w-5 h-5 rounded-md object-cover shadow-sm bg-zinc-800" 
                      />
                    ) : (
                      <div 
                        className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white shadow-inner"
                        style={{ backgroundColor: config.primary_color || '#6366f1' }}
                      >
                        {config.name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[11px] font-bold tracking-tight text-white truncate max-w-[90px]">{config.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="w-4 h-1 rounded" style={{ backgroundColor: config.primary_color || '#6366f1' }} />
                    <span className="w-4 h-1 rounded" style={{ backgroundColor: config.secondary_color || '#10b981' }} />
                  </div>
                </div>

                {/* Store Hero section */}
                <div className="flex-1 flex flex-col justify-center items-center text-center p-2 space-y-2">
                  <div 
                    className="px-2.5 py-1 text-[9px] font-bold text-white shadow-md shadow-black/20 rounded-md transition-all duration-300" 
                    style={{ backgroundColor: config.primary_color || '#6366f1' }}
                  >
                    Colección de Verano
                  </div>
                  <p className="text-[8px] text-zinc-500 max-w-[160px]">
                    Descubre los productos seleccionados para ti.
                  </p>
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SEO Form */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
            
            <form onSubmit={handleSubmitSeo} className="space-y-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Configurar SEO & Posicionamiento (Metatags)
              </h2>

              <div className="space-y-4">
                {/* Title Input */}
                <div className="space-y-2">
                  <label htmlFor="seoTitle" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Título de la página (seo_title)
                  </label>
                  <input
                    type="text"
                    id="seoTitle"
                    name="seoTitle"
                    value={config.seoTitle || ''}
                    onChange={handleTextChange}
                    maxLength={60}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                    placeholder="Ej: Tienda Oficial Acme | Calzado de Moda y Calidad"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-550 text-zinc-500">
                    <span>Aparece en la pestaña del navegador y resultados de Google.</span>
                    <span>{config.seoTitle?.length || 0}/60 sugerido</span>
                  </div>
                </div>

                {/* Description Input */}
                <div className="space-y-2">
                  <label htmlFor="seoDescription" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Descripción del sitio (seo_description)
                  </label>
                  <textarea
                    id="seoDescription"
                    name="seoDescription"
                    value={config.seoDescription || ''}
                    onChange={handleTextChange}
                    maxLength={160}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200 resize-none"
                    placeholder="Ej: Descubre la colección exclusiva de ropa y calzado Acme. Envíos a todo el país y facilidades de pago."
                  />
                  <div className="flex justify-between text-[11px] text-zinc-550 text-zinc-500">
                    <span>Resumen atractivo que incita a los usuarios a entrar a la web.</span>
                    <span>{config.seoDescription?.length || 0}/160 sugerido</span>
                  </div>
                </div>

                {/* Keywords Input */}
                <div className="space-y-2">
                  <label htmlFor="seoKeywords" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Palabras clave (seo_keywords)
                  </label>
                  <input
                    type="text"
                    id="seoKeywords"
                    name="seoKeywords"
                    value={config.seoKeywords || ''}
                    onChange={handleTextChange}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-600 transition-all duration-200"
                    placeholder="Ej: calzado, moda, zapatillas, indumentaria, tienda online, acme"
                  />
                  <p className="text-xs text-zinc-500">
                    Separadas por coma. Ayudan a definir los temas principales del sitio.
                  </p>
                </div>

                {/* OpenGraph Image Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Imagen OpenGraph (seo_og_image)
                  </label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      id="seoOgImage"
                      name="seoOgImage"
                      value={config.seoOgImage || ''}
                      onChange={handleTextChange}
                      className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white placeholder-zinc-650 transition-all duration-200"
                      placeholder="https://ejemplo.com/compartir-rrss.jpg o subí un archivo"
                    />
                    <label className="relative cursor-pointer flex items-center justify-center px-5 py-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 active:scale-98 text-zinc-300 text-sm font-semibold rounded-xl transition-all duration-200 shadow-md">
                      {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Imagen recomendada: 1200x630 píxeles. Se muestra al compartir el enlace de tu tienda en redes.
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
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
                    'Guardar Configuración SEO'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Search Engine & OG Previews */}
          <div className="space-y-6">
            {/* Google Search Snippet Preview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Google Search</h3>
              <div className="bg-white text-zinc-900 rounded-xl p-4 border border-zinc-200 font-sans text-left space-y-1">
                <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                  https://{config.domain || 'tu-tienda.com'} <span className="text-[8px]">▼</span>
                </div>
                <div className="text-base text-indigo-900 hover:underline cursor-pointer truncate font-medium">
                  {config.seoTitle || config.name || 'Mi Tienda Demo'}
                </div>
                <div className="text-sm text-zinc-600 line-clamp-2 leading-relaxed">
                  {config.seoDescription || `Bienvenido a ${config.name || 'Mi Tienda Demo'}. Descubre todos nuestros productos al mejor precio.`}
                </div>
              </div>
            </div>

            {/* Facebook/OG Card Preview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Compartir en Redes</h3>
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 flex flex-col">
                <div className="aspect-[1.91/1] w-full bg-zinc-900 relative flex items-center justify-center overflow-hidden border-b border-zinc-800">
                  {config.seoOgImage ? (
                    <img
                      src={resolveImageUrl(config.seoOgImage)}
                      alt="OG Share Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-10 h-10 text-zinc-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-zinc-500 block font-medium">Sin imagen seleccionada</span>
                    </div>
                  )}
                </div>
                <div className="p-3.5 space-y-1 text-left">
                  <div className="text-[10px] text-zinc-555 text-zinc-500 uppercase tracking-widest font-bold">
                    {config.domain || 'tu-tienda.com'}
                  </div>
                  <div className="text-sm font-bold text-white truncate leading-snug">
                    {config.seoTitle || config.name || 'Mi Tienda Demo'}
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {config.seoDescription || `Bienvenido a ${config.name || 'Mi Tienda Demo'}. Descubre todos nuestros productos al mejor precio.`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
