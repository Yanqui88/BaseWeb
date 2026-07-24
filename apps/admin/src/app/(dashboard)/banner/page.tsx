"use client";

import { useEffect, useMemo, useState } from "react";
import { getBannerAction, updateBannerAction, getUploadsAction, uploadFileAction } from "./actions";

type Banner = {
  desktopImageUrl: string;
  mobileImageUrl: string;
  href?: string | null;
  alt?: string | null;
  badge?: string | null;
  title?: string | null;
  subtitle?: string | null;
  buttonText?: string | null;
  isActive?: boolean;
};

type UploadItem = { name: string; url: string };

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function resolveImageUrl(apiUrl: string, url?: string | null) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/")) return `${apiUrl}${trimmed}`;
  return trimmed; // URL absoluta
}

export default function BannerPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG || "demo";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Banner>({
    desktopImageUrl: "",
    mobileImageUrl: "",
    href: "/ofertas",
    alt: "Promo destacada",
    badge: "",
    title: "",
    subtitle: "",
    buttonText: "",
    isActive: true,
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<"desktop" | "mobile">("desktop");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [query, setQuery] = useState("");

  const desktopPreviewUrl = useMemo(
    () => resolveImageUrl(apiUrl, form.desktopImageUrl),
    [apiUrl, form.desktopImageUrl]
  );
  const mobilePreviewUrl = useMemo(
    () => resolveImageUrl(apiUrl, form.mobileImageUrl),
    [apiUrl, form.mobileImageUrl]
  );

  const filteredUploads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uploads;
    return uploads.filter((u) => u.name.toLowerCase().includes(q));
  }, [uploads, query]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getBannerAction() as Banner | null;
        if (data) {
          setForm({
            desktopImageUrl: data.desktopImageUrl ?? "",
            mobileImageUrl: data.mobileImageUrl ?? "",
            href: data.href ?? "",
            alt: data.alt ?? "",
            badge: data.badge ?? "",
            title: data.title ?? "",
            subtitle: data.subtitle ?? "",
            buttonText: data.buttonText ?? "",
            isActive: data.isActive ?? true,
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [apiUrl, tenant]);

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);

    const res = await uploadFileAction(fd);
    if (!res.success) throw new Error(res.error || "Upload failed");
    return res.url;
  }

  async function onPickDesktop(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDesktop(true);
      setError(null);
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, desktopImageUrl: url }));
    } catch (err: any) {
      setError(err?.message ?? "Upload desktop failed");
    } finally {
      setUploadingDesktop(false);
      e.target.value = "";
    }
  }

  async function onPickMobile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingMobile(true);
      setError(null);
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, mobileImageUrl: url }));
    } catch (err: any) {
      setError(err?.message ?? "Upload mobile failed");
    } finally {
      setUploadingMobile(false);
      e.target.value = "";
    }
  }

  async function openLibrary(target: "desktop" | "mobile") {
    setModalTarget(target);
    setModalOpen(true);
    setLibraryError(null);

    // Si ya cargamos una vez, no hace falta recargar siempre
    if (uploads.length > 0) return;

    try {
      setLibraryLoading(true);
      const data = (await getUploadsAction()) as UploadItem[];
      setUploads(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setLibraryError(e?.message ?? "Library load error");
    } finally {
      setLibraryLoading(false);
    }
  }

  function pickFromLibrary(url: string) {
    if (modalTarget === "desktop") {
      setForm((f) => ({ ...f, desktopImageUrl: url }));
    } else {
      setForm((f) => ({ ...f, mobileImageUrl: url }));
    }
    setModalOpen(false);
  }

  async function onSave() {
    if (!isNonEmpty(form.desktopImageUrl) || !isNonEmpty(form.mobileImageUrl)) {
      setError("desktopImageUrl y mobileImageUrl son obligatorios (URL o upload).");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        desktopImageUrl: form.desktopImageUrl.trim(),
        mobileImageUrl: form.mobileImageUrl.trim(),
        href: isNonEmpty(form.href) ? form.href.trim() : null,
        alt: isNonEmpty(form.alt) ? form.alt.trim() : null,
        badge: isNonEmpty(form.badge) ? form.badge.trim() : null,
        title: isNonEmpty(form.title) ? form.title.trim() : null,
        subtitle: isNonEmpty(form.subtitle) ? form.subtitle.trim() : null,
        buttonText: isNonEmpty(form.buttonText) ? form.buttonText.trim() : null,
        isActive: form.isActive ?? true,
      };

      const res = await updateBannerAction(payload);
      if (!res.success) throw new Error(res.error || "Save failed");
    } catch (e: any) {
      setError(e?.message ?? "Unknown save error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Admin · Banner</h1>
        <p className="mt-4 text-gray-600">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Admin · Banner</h1>
      <p className="mt-2 text-sm text-gray-600">
        Podés pegar URLs o subir imágenes (se guardan en la API en <code>/uploads</code>).
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Desktop image */}
        <section className="rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Desktop image</div>
              <div className="text-xs text-gray-600">
                Subí, pegá URL o elegí una imagen existente.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openLibrary("desktop")}
                className="rounded-xl border px-3 py-2 text-sm"
                disabled={saving || uploadingDesktop}
              >
                Elegir existente
              </button>

              <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm">
                {uploadingDesktop ? "Subiendo..." : "Subir"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickDesktop}
                  disabled={uploadingDesktop || saving}
                />
              </label>
            </div>
          </div>

          <input
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            value={form.desktopImageUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, desktopImageUrl: e.target.value }))
            }
            placeholder="https://... o /uploads/archivo.png"
            disabled={saving}
          />

          {desktopPreviewUrl && (
            <img
              src={desktopPreviewUrl}
              alt="Desktop preview"
              className="mt-3 w-full rounded-2xl border object-cover"
            />
          )}
        </section>

        {/* Mobile image */}
        <section className="rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Mobile image</div>
              <div className="text-xs text-gray-600">
                Subí, pegá URL o elegí una imagen existente.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openLibrary("mobile")}
                className="rounded-xl border px-3 py-2 text-sm"
                disabled={saving || uploadingMobile}
              >
                Elegir existente
              </button>

              <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm">
                {uploadingMobile ? "Subiendo..." : "Subir"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickMobile}
                  disabled={uploadingMobile || saving}
                />
              </label>
            </div>
          </div>

          <input
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            value={form.mobileImageUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, mobileImageUrl: e.target.value }))
            }
            placeholder="https://... o /uploads/archivo.png"
            disabled={saving}
          />

          {mobilePreviewUrl && (
            <img
              src={mobilePreviewUrl}
              alt="Mobile preview"
              className="mt-3 w-full rounded-2xl border object-cover"
            />
          )}
        </section>

        {/* Text + link fields */}
        <section className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Contenido</div>

          <div className="mt-3 grid gap-3">
            <Field
              label="Link (href)"
              value={form.href ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, href: v }))}
              placeholder="/ofertas o https://..."
              disabled={saving}
            />
            <Field
              label="Alt text"
              value={form.alt ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, alt: v }))}
              placeholder="Texto alternativo"
              disabled={saving}
            />
            <Field
              label="Badge"
              value={form.badge ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, badge: v }))}
              placeholder="Ej: 3 cuotas sin interés"
              disabled={saving}
            />
            <Field
              label="Title"
              value={form.title ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Ej: Nueva colección"
              disabled={saving}
            />
            <Field
              label="Subtitle"
              value={form.subtitle ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, subtitle: v }))}
              placeholder="Ej: Envíos a todo el país"
              disabled={saving}
            />
            <Field
              label="Button text"
              value={form.buttonText ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, buttonText: v }))}
              placeholder="Ej: Ver ofertas"
              disabled={saving}
            />
          </div>
        </section>

        <button
          onClick={onSave}
          disabled={saving || uploadingDesktop || uploadingMobile}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>

        <div className="text-xs text-gray-500">
          Tip: si querés que el banner no sea clickeable, dejá <code>href</code> vacío.
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Elegir imagen existente</div>
                <div className="text-xs text-gray-600">
                  Target: <b>{modalTarget}</b> · Click en una imagen para seleccionarla.
                </div>
              </div>

              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Buscar por nombre de archivo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={async () => {
                  // recargar manual
                  try {
                    setLibraryLoading(true);
                    setLibraryError(null);
                    const data = (await getUploadsAction()) as UploadItem[];
                    setUploads(Array.isArray(data) ? data : []);
                  } catch (e: any) {
                    setLibraryError(e?.message ?? "Library reload error");
                  } finally {
                    setLibraryLoading(false);
                  }
                }}
                disabled={libraryLoading}
              >
                {libraryLoading ? "..." : "Recargar"}
              </button>
            </div>

            {libraryError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {libraryError}
              </div>
            )}

            <div className="mt-4">
              {libraryLoading ? (
                <div className="text-sm text-gray-600">Cargando biblioteca...</div>
              ) : filteredUploads.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No hay imágenes (o no coincide la búsqueda).
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {filteredUploads.map((u) => (
                    <button
                      key={u.name}
                      className="group overflow-hidden rounded-xl border text-left"
                      onClick={() => pickFromLibrary(u.url)}
                      title={u.name}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-50">
                        <img
                          src={resolveImageUrl(apiUrl, u.url)}
                          alt={u.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2">
                        <div className="truncate text-xs text-gray-700">{u.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Nota: por ahora no permitimos borrar desde acá para evitar borrar imágenes en uso.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}