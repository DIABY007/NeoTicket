"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ScannerCameraPanel } from "@/components/scanner/scanner-camera-panel";
import { ScannerManagement } from "@/components/organizer/scanner-management";

/* ── Icons ──────────────────────────────────────────────────── */

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5V21h12V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21c1.8-3.3 4.4-5 8-5s6.2 1.7 8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Types ───────────────────────────────────────────────────── */

type ScanEvent = { id: string; title: string; date: string };

type Tab = "scanner" | "staff";

/* ── Page ────────────────────────────────────────────────────── */

export default function ScannerPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("scanner");
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const canScan = useMemo(() => {
    if (!user) return false;
    return (
      user.roles.includes("scanner") ||
      user.roles.includes("organizer") ||
      user.roles.includes("admin")
    );
  }, [user]);

  const isOrganizer = useMemo(() => {
    if (!user) return false;
    return user.roles.includes("organizer") || user.roles.includes("admin");
  }, [user]);

  /* ── Load events ─────────────────────────────────────────── */

  useEffect(() => {
    if (!canScan) return;

    const loadEvents = async () => {
      setIsLoadingEvents(true);
      setEventsError(null);

      try {
        const res = await fetch("/api/scanner/events", { cache: "no-store" });
        const payload = (await res.json()) as {
          success: boolean;
          error?: string;
          events?: ScanEvent[];
        };

        if (!res.ok || !payload.success) {
          setEventsError(payload.error ?? "Chargement des événements impossible.");
          return;
        }

        const next = payload.events ?? [];
        setEvents(next);
        setSelectedEventId((c) => c || next[0]?.id || "");
      } catch {
        setEventsError("Erreur réseau.");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    void loadEvents();
  }, [canScan]);

  /* ── Early returns ───────────────────────────────────────── */

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <p className="text-sm text-white/60">Chargement...</p>
      </main>
    );
  }

  if (!canScan) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center text-white">
        <h1 className="text-xl font-semibold">Accès contrôle</h1>
        <p className="mt-3 text-sm text-red-400">
          Rôle scanneur, organisateur ou admin requis.
        </p>
      </main>
    );
  }

  /* ── Main render ─────────────────────────────────────────── */

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-neutral-950 pb-20 text-white">
      {/* ── Event selector (top) ────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/95 px-4 pb-3 pt-4 backdrop-blur">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-white/70">Événement en cours</span>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={isLoadingEvents}
            className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2.5 text-white outline-none"
          >
            {events.length === 0 && (
              <option value="">
                {isLoadingEvents ? "Chargement..." : "Aucun événement"}
              </option>
            )}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} — {new Date(ev.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
        </label>

        {eventsError && (
          <p className="mt-2 text-xs text-red-400">{eventsError}</p>
        )}

        {/* ── Tab switcher (only for organizers) ───────────── */}
        {isOrganizer && (
          <div className="mt-3 flex gap-1 rounded-xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("scanner")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "scanner"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <IconScan />
                Scanner
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "staff"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <IconUser />
                Staff
              </span>
            </button>
          </div>
        )}
      </header>

      {/* ── Tab content ─────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-4">
        {activeTab === "scanner" && (
          <ScannerCameraPanel selectedEventId={selectedEventId} />
        )}

        {activeTab === "staff" && isOrganizer && (
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-1">
            <ScannerManagement />
          </div>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-around px-2 py-2">
          <Link
            href="/"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-white/50"
          >
            <IconHome />
            Événements
          </Link>

          <Link
            href="/organizer/new"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-white/50"
          >
            <IconPlus />
            Ajouter
          </Link>

          <Link
            href="/scanner/scan"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs text-black"
          >
            <IconScan />
            Scanner
          </Link>

          <Link
            href="/?tab=profile"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs text-white/50"
          >
            <IconUser />
            Profil
          </Link>
        </div>
      </nav>
    </main>
  );
}
