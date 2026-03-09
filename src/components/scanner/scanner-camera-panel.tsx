"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

import { useAuth } from "@/components/auth/auth-provider";

/* ── Beep helper ─────────────────────────────────────────────── */

function playBeep(frequency: number, durationMs: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // AudioContext unavailable — ignore
  }
}

/* ── Types ───────────────────────────────────────────────────── */

type ScanOverlay = {
  tone: "green" | "red";
  title: string;
  detail: string;
};

type ScanStats = { scanned: number; total: number };

/* ── Component ───────────────────────────────────────────────── */

export function ScannerCameraPanel({
  selectedEventId,
}: {
  selectedEventId: string;
}) {
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isValidatingRef = useRef(false);

  const [overlay, setOverlay] = useState<ScanOverlay | null>(null);
  const [stats, setStats] = useState<ScanStats>({ scanned: 0, total: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  /* ── Fetch stats ────────────────────────────────────────── */

  const refreshStats = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(
        `/api/scanner/stats?eventId=${encodeURIComponent(selectedEventId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        success: boolean;
        scanned?: number;
        total?: number;
      };
      if (data.success) {
        setStats({ scanned: data.scanned ?? 0, total: data.total ?? 0 });
      }
    } catch {
      /* network error — keep old stats */
    }
  }, [selectedEventId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  /* ── QR decode handler ──────────────────────────────────── */

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (isValidatingRef.current) return;
      if (!selectedEventId || !decodedText.trim()) return;

      isValidatingRef.current = true;

      try {
        const res = await fetch("/api/scanner/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            qrCodeHash: decodedText.trim(),
          }),
        });

        const payload = (await res.json()) as {
          success: boolean;
          message?: string;
          error?: string;
          code?: string;
          buyerName?: string;
        };

        if (payload.success) {
          playBeep(880, 150);
          setOverlay({
            tone: "green",
            title: "VALIDE",
            detail: payload.buyerName ?? "Ticket validé",
          });
          setStats((s) => ({ ...s, scanned: s.scanned + 1 }));
        } else {
          playBeep(300, 400);
          const detail =
            payload.code === "already_scanned"
              ? "DÉJÀ SCANNÉ"
              : payload.code === "wrong_event"
                ? "MAUVAIS ÉVÉNEMENT"
                : payload.error ?? "Ticket invalide";
          setOverlay({ tone: "red", title: "INVALIDE", detail });
        }
      } catch {
        playBeep(300, 400);
        setOverlay({
          tone: "red",
          title: "ERREUR",
          detail: "Erreur réseau",
        });
      }

      setTimeout(() => {
        setOverlay(null);
        isValidatingRef.current = false;
      }, 2000);
    },
    [selectedEventId],
  );

  /* ── Camera lifecycle ───────────────────────────────────── */

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* already stopped */
      }
      scannerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!containerRef.current) return;

    await stopCamera();
    setCameraError(null);

    const scannerId = "neo-qr-reader";
    let el = document.getElementById(scannerId);
    if (!el) {
      el = document.createElement("div");
      el.id = scannerId;
      containerRef.current.appendChild(el);
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (text) => void handleScan(text),
        () => {
          /* ignore non-decode frames */
        },
      );
      setIsRunning(true);
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "Autorisez l'accès caméra dans votre navigateur."
            : err.name === "NotFoundError"
              ? "Aucune caméra détectée."
              : `Erreur caméra: ${err.message}`
          : "Impossible d'ouvrir la caméra.";
      setCameraError(msg);
    }
  }, [handleScan, stopCamera]);

  /* Auto-start camera when event is selected */
  useEffect(() => {
    if (selectedEventId && user) {
      void startCamera();
    }
    return () => {
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, user]);

  /* ── Render ─────────────────────────────────────────────── */

  if (!user) return null;

  return (
    <div className="relative flex flex-col items-center">
      {/* ── Stats counter ────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-400">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        Scannés : {stats.scanned} / {stats.total}
      </div>

      {/* ── Camera zone ──────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black"
        style={{ minHeight: 380 }}
      >
        {/* Scan overlay */}
        {overlay && (
          <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 text-white transition-opacity ${
              overlay.tone === "green"
                ? "bg-emerald-500/90"
                : "bg-red-500/90"
            }`}
          >
            {overlay.tone === "green" ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
            <p className="text-2xl font-black tracking-wider">{overlay.title}</p>
            <p className="text-lg font-semibold">{overlay.detail}</p>
          </div>
        )}

        {/* Idle state — big start button if camera not running */}
        {!isRunning && !cameraError && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16">
              <path
                d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-semibold">Activer la caméra</span>
          </button>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-amber-400">
              <path d="M12 9v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p className="text-sm">{cameraError}</p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="mt-2 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* No event selected hint */}
      {!selectedEventId && (
        <p className="mt-4 text-center text-sm text-white/60">
          Sélectionnez un événement pour commencer le scan.
        </p>
      )}
    </div>
  );
}
