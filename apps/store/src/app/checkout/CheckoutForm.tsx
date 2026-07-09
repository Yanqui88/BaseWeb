"use client";

import { useState } from "react";
import ShippingCalculator from "@/components/ShippingCalculator";

type CheckoutItem = {
  title: string;
  quantity: number;
  unit_price: number;
};

type CheckoutCustomer = {
  email: string;
};

export default function CheckoutForm() {
  // Form fields state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");

  // Shipping selection state
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingMethodName, setShippingMethodName] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShippingSelected = (cost: number, name: string | null) => {
    setShippingCost(cost);
    setShippingMethodName(name);
  };

  // Hardcoded cart item for guest checkout demo
  const cartItem: CheckoutItem = {
    title: "Zapatillas de Running",
    quantity: 1,
    unit_price: 45000,
  };

  const formatARS = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !address || !city || !postalCode || !phone) {
      setError("Por favor, completa todos los campos requeridos.");
      return;
    }
    if (shippingCost === 0 || !shippingMethodName) {
      setError("Por favor, calcula y selecciona un método de envío antes de pagar.");
      return;
    }

    setLoading(true);
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const tenantDomain = typeof window !== "undefined" ? window.location.hostname : "localhost";

    // Obtener el location_id de la sesión (o usar un valor por defecto de demo)
    // En producción, esto vendría del contexto de la sucursal seleccionada
    const locationId = sessionStorage.getItem("active_location_id") || "00000000-0000-0000-0000-000000000000";

    try {
      const subtotal = cartItem.unit_price * cartItem.quantity;
      const total = subtotal + shippingCost;

      // Mapear el método de envío al tipo del DTO
      const shippingMethodMap: Record<string, string> = {
        "Andreani Estándar": "andreani_standard",
        "Andreani Express": "andreani_express",
        "Retiro en Sucursal": "pickup",
        "Moto Local": "moto_local",
      };
      const shippingMethodValue = shippingMethodMap[shippingMethodName ?? ""] ?? "andreani_standard";

      const orderPayload = {
        locationId,
        customerEmail: email,
        customerName: fullName,
        customerPhone: phone,
        shippingMethod: shippingMethodValue,
        shippingAddress: {
          street: address,
          number: "S/N",
          city,
          state: city,
          zip_code: postalCode,
          country: "AR",
        },
        subtotal,
        shippingCost,
        total,
        items: [
          {
            productId: "00000000-0000-0000-0000-000000000001", // demo product id
            quantity: cartItem.quantity,
            unitPrice: cartItem.unit_price,
          },
        ],
      };

      const response = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-domain": tenantDomain,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message || "Error al crear la orden.");
      }

      const data = await response.json() as { success: boolean; data: { initPoint?: string } };
      if (data.data?.initPoint) {
        window.location.href = data.data.initPoint;
      } else {
        throw new Error("No se recibió la URL de pago desde el backend.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Hubo un error al procesar el pago. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-12">
      {/* Columna Izquierda: Formulario de Envío */}
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold border border-blue-500/30">
              1
            </span>
            Datos de Envío
          </h2>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 backdrop-blur-sm animate-pulse">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Correo Electrónico *
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Nombre Completo *
              </label>
              <input
                id="fullName"
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Dirección *
              </label>
              <input
                id="address"
                type="text"
                required
                disabled={loading}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. del Libertador 1234, Piso 2A"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="city" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Ciudad *
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  disabled={loading}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Buenos Aires"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="postalCode" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Código Postal *
                </label>
                <input
                  id="postalCode"
                  type="text"
                  required
                  disabled={loading}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1425"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Teléfono de Contacto *
              </label>
              <input
                id="phone"
                type="tel"
                required
                disabled={loading}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 2345 6789"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <ShippingCalculator
          items={[cartItem]}
          onShippingSelected={handleShippingSelected}
          onZipCalculated={setPostalCode}
        />
      </div>

      {/* Columna Derecha: Resumen de la Orden */}
      <div className="lg:col-span-5 space-y-6">
        <div className="sticky top-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold border border-blue-500/30">
              3
            </span>
            Resumen del Pedido
          </h2>

          {/* Product list */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4 rounded-2xl bg-white/[0.02] p-3 border border-white/[0.04]">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-900 border border-white/[0.08] flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-50" />
                <span className="text-2xl">👟</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{cartItem.title}</h4>
                <p className="text-xs text-slate-400 mt-1">Cantidad: {cartItem.quantity}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white">{formatARS(cartItem.unit_price)}</span>
              </div>
            </div>
          </div>

          {/* Subtotal, envio and total details */}
          <div className="border-t border-white/[0.08] pt-4 space-y-3 mb-6">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Subtotal</span>
              <span className="text-white font-medium">{formatARS(cartItem.unit_price * cartItem.quantity)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 items-center">
              <span className="truncate max-w-[200px]">
                Envío {shippingMethodName && `(${shippingMethodName})`}
              </span>
              {shippingCost > 0 ? (
                <span className="text-white font-medium">{formatARS(shippingCost)}</span>
              ) : (
                <span className="text-emerald-400 font-medium tracking-wide uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  A calcular
                </span>
              )}
            </div>
            <div className="border-t border-white/[0.08] pt-4 flex justify-between text-base font-bold text-white">
              <span>Total</span>
              <span className="text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-extrabold">
                {formatARS(cartItem.unit_price * cartItem.quantity + shippingCost)}
              </span>
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 group cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando pago...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Pagar con Mercado Pago</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            )}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          </button>

          <p className="text-center text-[10px] text-slate-500 mt-4 leading-relaxed">
            Al hacer clic en pagar, serás redirigido a la pasarela oficial de Mercado Pago de forma segura para completar tu transacción.
          </p>
        </div>
      </div>
    </form>
  );
}
