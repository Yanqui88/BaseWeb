"use client";

import { useState } from "react";

export interface ShippingOption {
  nombre: string;
  tarifa: number;
  plazo: number | null;
}

interface ShippingCalculatorProps {
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  onShippingSelected: (cost: number, name: string | null) => void;
  onZipCalculated?: (zip: string) => void;
}

const getProductDimensions = (title: string, quantity: number) => {
  const normalizedTitle = title.toLowerCase();
  if (
    normalizedTitle.includes("zapatilla") ||
    normalizedTitle.includes("calzado") ||
    normalizedTitle.includes("shoe") ||
    normalizedTitle.includes("running")
  ) {
    return {
      weightGrams: 800,
      heightCm: 12,
      widthCm: 20,
      depthCm: 32,
      quantity,
    };
  }
  // Default dimensions for standard e-commerce box
  return {
    weightGrams: 500,
    heightCm: 10,
    widthCm: 15,
    depthCm: 15,
    quantity,
  };
};

export default function ShippingCalculator({
  items,
  onShippingSelected,
  onZipCalculated,
}: ShippingCalculatorProps) {
  const [destinationZip, setDestinationZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatARS = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCalculate = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!destinationZip.trim()) {
      setError("Por favor, ingresa un código postal.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedOption(null);
    onShippingSelected(0, null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const tenantDomain =
      typeof window !== "undefined" ? window.location.hostname : "localhost";

    try {
      const response = await fetch(`${apiUrl}/logistics/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-domain": tenantDomain,
        },
        body: JSON.stringify({
          destinationZip: destinationZip.trim(),
          products: items.map((item) =>
            getProductDimensions(item.title, item.quantity)
          ),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || "Error al cotizar el envío. Verifica el código postal."
        );
      }

      const data = await response.json();
      if (data && data.opciones && Array.isArray(data.opciones)) {
        setOptions(data.opciones);
        if (onZipCalculated) {
          onZipCalculated(destinationZip.trim());
        }
        if (data.opciones.length === 0) {
          setError("No hay métodos de entrega disponibles para este código postal.");
        }
      } else {
        throw new Error("Respuesta inválida del servidor de logística.");
      }
    } catch (err: any) {
      setError(err.message || "Hubo un error al calcular el envío. Inténtalo de nuevo.");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (option: ShippingOption) => {
    setSelectedOption(option.nombre);
    onShippingSelected(option.tarifa, option.nombre);
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold border border-blue-500/30">
          2
        </span>
        Método de Envío
      </h3>

      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tu Código Postal (ej: 1425)"
            value={destinationZip}
            onChange={(e) => setDestinationZip(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCalculate(e);
              }
            }}
            disabled={loading}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={() => handleCalculate()}
          disabled={loading}
          className="rounded-xl bg-white/10 border border-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Calculando...
            </>
          ) : (
            "Calcular"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 backdrop-blur-sm animate-pulse">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 w-full rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="h-16 w-full rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      )}

      {!loading && options.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Selecciona un método de entrega:
          </p>
          <div className="grid gap-3">
            {options.map((option) => {
              const isSelected = selectedOption === option.nombre;
              return (
                <button
                  key={option.nombre}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 backdrop-blur-md cursor-pointer flex justify-between items-center group relative overflow-hidden ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.01]"
                      : "border-white/[0.06] bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03] hover:scale-[1.01] active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors duration-300 ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-slate-500 group-hover:border-slate-400"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{option.nombre}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {option.plazo
                          ? `Entrega estimada en ${option.plazo} ${
                              option.plazo === 1 ? "día" : "días"
                            } hábiles`
                          : "Plazo de entrega no especificado"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{formatARS(option.tarifa)}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute inset-0 border border-blue-500/30 rounded-2xl pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
