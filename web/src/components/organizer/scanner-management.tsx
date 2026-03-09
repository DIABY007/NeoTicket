"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PhoneInput } from "@/components/phone-input";

type DashboardEvent = {
  id: string;
  title: string;
};

type Scanner = {
  id: string;
  phone: string;
  roles: string[];
  status: "active" | "invited" | "blocked";
};

type DashboardPayload = {
  success: boolean;
  events?: Array<{
    id: string;
    title: string;
  }>;
};

export function ScannerManagement() {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [scanners, setScanners] = useState<Scanner[]>([]);

  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingScanners, setIsLoadingScanners] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const e164Preview = useMemo(() => {
    const digits = phoneInput.replace(/\D+/g, "");
    if (!digits) {
      return "";
    }

    return digits.startsWith("226") ? `+${digits}` : `+226${digits}`;
  }, [phoneInput]);

  useEffect(() => {
    const loadEvents = async () => {
      setIsLoadingEvents(true);
      setError(null);

      try {
        const response = await fetch("/api/organizer/dashboard", { cache: "no-store" });
        const payload = (await response.json()) as DashboardPayload;

        if (!response.ok || !payload.success) {
          setError("Chargement des evenements impossible.");
          return;
        }

        const mappedEvents = (payload.events ?? []).map((event) => ({
          id: event.id,
          title: event.title,
        }));

        setEvents(mappedEvents);
        if (mappedEvents.length > 0) {
          setSelectedEventId((current) => current || mappedEvents[0].id);
        }
      } catch {
        setError("Erreur reseau pendant le chargement des evenements.");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    void loadEvents();
  }, []);

  useEffect(() => {
    const loadScanners = async () => {
      if (!selectedEventId) {
        setScanners([]);
        return;
      }

      setIsLoadingScanners(true);

      try {
        const response = await fetch(`/api/organizer/scanners?eventId=${selectedEventId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          success: boolean;
          scanners?: Scanner[];
        };

        if (!response.ok || !payload.success) {
          setScanners([]);
          return;
        }

        setScanners(payload.scanners ?? []);
      } catch {
        setScanners([]);
      } finally {
        setIsLoadingScanners(false);
      }
    };

    void loadScanners();
  }, [selectedEventId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedEventId) {
      setError("Selectionnez un evenement.");
      return;
    }

    if (!e164Preview) {
      setError("Entrez un numero valide.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/organizer/scanners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          phone: e164Preview,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Invitation impossible.");
        return;
      }

      setSuccess(payload.message ?? "Scanneur invite.");
      setPhoneInput("");

      const refresh = await fetch(`/api/organizer/scanners?eventId=${selectedEventId}`, {
        cache: "no-store",
      });
      const refreshPayload = (await refresh.json()) as {
        success: boolean;
        scanners?: Scanner[];
      };

      if (refresh.ok && refreshPayload.success) {
        setScanners(refreshPayload.scanners ?? []);
      }
    } catch {
      setError("Erreur reseau pendant l'invitation du scanneur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h2 className="text-xl font-semibold text-white">Inviter un scanneur</h2>
      <p className="mt-2 text-sm text-white/60">
        Ajoutez un staff via numéro pour un événement précis.
      </p>

      {isLoadingEvents ? <p className="mt-4 text-sm text-white/50">Chargement...</p> : null}

      {!isLoadingEvents ? (
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1 text-sm text-white">
            <span className="font-medium text-white/70">Événement</span>
            <select
              value={selectedEventId}
              onChange={(event) => {
                setSelectedEventId(event.target.value);
              }}
              className="rounded-xl border border-white/15 bg-neutral-800 px-3 py-3 text-white outline-none"
              required
            >
              {events.length === 0 ? <option value="">Aucun evenement</option> : null}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white">
            <span className="font-medium text-white/70">Numéro du scanneur</span>
            <PhoneInput
              value={phoneInput}
              onChange={setPhoneInput}
              variant="dark"
              required
            />
            <span className="text-xs text-white/40">
              Numéro final envoyé : {e164Preview || "(vide)"}
            </span>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || events.length === 0}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
          >
            {isSubmitting ? "Invitation en cours..." : "Inviter le scanneur"}
          </button>
        </form>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-white">Scanneurs assignés</h3>
        {isLoadingScanners ? <p className="mt-2 text-sm text-white/50">Chargement...</p> : null}
        {!isLoadingScanners && scanners.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">Aucun scanneur assigné.</p>
        ) : null}

        {!isLoadingScanners && scanners.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {scanners.map((scanner) => (
              <li key={scanner.id} className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-2">
                <span className="font-medium text-white">{scanner.phone}</span>
                <span className="ml-2 text-white/50">statut: {scanner.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
