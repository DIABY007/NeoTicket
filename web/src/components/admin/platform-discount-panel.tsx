"use client";

import { FormEvent, useEffect, useState } from "react";
import { showToast } from "./toast";

type DiscountResponse = {
  success: boolean;
  error?: string;
  platformDiscountPercent?: number;
  envFallback?: number;
  message?: string;
};

export function PlatformDiscountPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [platformDiscountPercent, setPlatformDiscountPercent] = useState("0");
  const [envFallback, setEnvFallback] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/platform-discount", { cache: "no-store" });
        const payload = (await response.json()) as DiscountResponse;

        if (!response.ok || !payload.success || payload.platformDiscountPercent === undefined) {
          setError(payload.error ?? "Chargement de la remise impossible.");
          return;
        }

        setPlatformDiscountPercent(String(payload.platformDiscountPercent));
        setEnvFallback(payload.envFallback ?? 0);
      } catch {
        setError("Erreur réseau pendant le chargement de la remise plateforme.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = Number.parseFloat(platformDiscountPercent);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("La remise doit être entre 0 et 100.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/platform-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformDiscountPercent: parsed }),
      });

      const payload = (await response.json()) as DiscountResponse;
      if (!response.ok || !payload.success || payload.platformDiscountPercent === undefined) {
        setError(payload.error ?? "Mise à jour impossible.");
        return;
      }

      setPlatformDiscountPercent(String(payload.platformDiscountPercent));
      showToast(payload.message ?? "Remise mise à jour !", "success");
    } catch {
      setError("Erreur réseau pendant la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-5">
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-left shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <span className="text-sm font-semibold">Remise plateforme</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-black/60">
            {platformDiscountPercent}%
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-black/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Accordion content */}
      {open && (
        <div className="mt-1 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">
            S&apos;applique sur tous les événements publiés.
            Fallback env : {envFallback}%
          </p>

          {isLoading ? <p className="mt-3 text-xs text-black/50">Chargement...</p> : null}

          {!isLoading && (
            <form className="mt-3 flex items-end gap-3" onSubmit={onSubmit}>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-black/60">Remise (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={platformDiscountPercent}
                  onChange={(e) => setPlatformDiscountPercent(e.target.value)}
                  className="w-28 rounded-xl border border-black/15 bg-[#fffdf8] px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? "..." : "Enregistrer"}
              </button>
            </form>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
