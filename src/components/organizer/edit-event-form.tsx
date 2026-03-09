"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EventStatus = "draft" | "published" | "ended" | "cancelled";

type EditableEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  city: string | null;
  date: string;
  end_date: string | null;
  official_price: number;
  organizer_price: number;
  status: EventStatus;
};

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function EditEventForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EditableEvent | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [officialPrice, setOfficialPrice] = useState("1000");
  const [organizerPrice, setOrganizerPrice] = useState("1000");
  const [status, setStatus] = useState<EventStatus>("published");

  useEffect(() => {
    let isActive = true;

    const loadEvent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/organizer/events/${eventId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          success: boolean;
          error?: string;
          event?: EditableEvent;
        };

        if (!response.ok || !payload.success || !payload.event) {
          if (isActive) {
            setError(payload.error ?? "Chargement evenement impossible.");
          }
          return;
        }

        if (!isActive) return;

        const nextEvent = payload.event;
        setEventData(nextEvent);
        setTitle(nextEvent.title);
        setDescription(nextEvent.description ?? "");
        setSlug(nextEvent.slug ?? "");
        setCity(nextEvent.city ?? "");
        setStartDate(toLocalDateTimeInput(nextEvent.date));
        setEndDate(toLocalDateTimeInput(nextEvent.end_date));
        setOfficialPrice(String(nextEvent.official_price));
        setOrganizerPrice(String(nextEvent.organizer_price));
        setStatus(nextEvent.status);
      } catch {
        if (isActive) {
          setError("Erreur reseau pendant le chargement de l'evenement.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadEvent();

    return () => {
      isActive = false;
    };
  }, [eventId]);

  const statusLabel = useMemo(
    () => ({
      draft: "Brouillon",
      published: "Publie",
      ended: "Termine",
      cancelled: "Annule",
    }),
    [],
  );

  const onSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          slug,
          city,
          startDate,
          endDate: endDate || null,
          officialPrice: Number.parseInt(officialPrice, 10),
          organizerPrice: Number.parseInt(organizerPrice, 10),
          status,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        event?: EditableEvent;
      };

      if (!response.ok || !payload.success || !payload.event) {
        setError(payload.error ?? "Mise a jour evenement impossible.");
        return;
      }

      setEventData(payload.event);
      setSuccess("Evenement mis a jour avec succes.");
    } catch {
      setError("Erreur reseau pendant la mise a jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-black/60">Chargement evenement...</p>;
  }

  if (!eventData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Evenement introuvable."}
      </div>
    );
  }

  return (
    <section className="neo-card w-full max-w-2xl rounded-2xl p-6">
      <h2 className="text-xl font-bold">Modifier evenement</h2>
      <p className="mt-2 text-sm text-black/70">Ajustez les informations de votre evenement.</p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Titre</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
            className="neo-input rounded-xl px-3 py-3"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={1000}
            className="neo-input rounded-xl px-3 py-3"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">URL marketing (slug)</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            maxLength={120}
            className="neo-input rounded-xl px-3 py-3"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Ville</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
            maxLength={120}
            className="neo-input rounded-xl px-3 py-3"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Date de debut</span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className="neo-input rounded-xl px-3 py-3"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Date de fin (optionnel)</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="neo-input rounded-xl px-3 py-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Prix officiel (FCFA)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={officialPrice}
              onChange={(event) => setOfficialPrice(event.target.value)}
              required
              className="neo-input rounded-xl px-3 py-3"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Prix promo organisateur (FCFA)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={organizerPrice}
              onChange={(event) => setOrganizerPrice(event.target.value)}
              required
              className="neo-input rounded-xl px-3 py-3"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Statut</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as EventStatus)}
            className="neo-input rounded-xl px-3 py-3"
          >
            {(["draft", "published", "ended", "cancelled"] as const).map((value) => (
              <option key={value} value={value}>
                {statusLabel[value]}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {success ? <p className="text-sm text-neo-teal">{success}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="neo-btn rounded-xl px-4 py-3 text-sm"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/?tab=profile")}
            className="rounded-xl border border-black/8 px-4 py-3 text-sm font-medium hover:border-neo-teal/30 hover:text-neo-teal transition"
          >
            Retour profil
          </button>
        </div>
      </form>
    </section>
  );
}
