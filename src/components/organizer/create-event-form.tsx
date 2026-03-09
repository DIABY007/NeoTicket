"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { PhoneInput } from "@/components/phone-input";

const POPULAR_CITIES = ["Ouagadougou", "Bobo-Dioulasso", "Koudougou"];
const COMMISSION_RATE = 0.1;

type CreatedEvent = {
  id: string;
  title: string;
  date: string;
  status: string;
};

type Props = {
  platformDiscountPercent?: number;
  onCreated?: () => void;
};

export function CreateEventForm({
  platformDiscountPercent = 0,
  onCreated,
}: Props) {
  /* ---- form fields ---- */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedCity, setSelectedCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [officialPrice, setOfficialPrice] = useState("");
  const [organizerPrice, setOrganizerPrice] = useState("");
  const [omPhone, setOmPhone] = useState("");

  /* ---- ui state ---- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);

  /* ---- computed ---- */
  const effectiveCity =
    selectedCity === "__custom__" ? customCity.trim() : selectedCity;
  const offNum = parseInt(officialPrice, 10) || 0;
  const orgNum = parseInt(organizerPrice, 10) || 0;
  const clientPays =
    orgNum > 0
      ? Math.round(orgNum * (1 - platformDiscountPercent / 100))
      : 0;
  const organizerGain =
    clientPays > 0 ? Math.round(clientPays * (1 - COMMISSION_RATE)) : 0;
  const showCalculator = offNum > 0 && orgNum > 0 && orgNum <= offNum;
  const priceError = orgNum > offNum && offNum > 0;

  /* ---- handlers ---- */
  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image trop volumineuse (max 5 Mo).");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedEvent(null);
    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("city", effectiveCity);
      if (venue.trim()) fd.set("venue", venue.trim());
      fd.set("startDate", startDate);
      if (endDate) fd.set("endDate", endDate);
      fd.set("officialPrice", officialPrice);
      fd.set("organizerPrice", organizerPrice);
      if (omPhone) {
        fd.set("omReceiverPhone", `+226${omPhone.replace(/\D/g, "")}`);
      }
      if (imageFile) fd.set("image", imageFile);

      const res = await fetch("/api/organizer/events", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        success: boolean;
        error?: string;
        event?: CreatedEvent;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Creation impossible.");
        return;
      }

      setCreatedEvent(data.event ?? null);
      setTitle("");
      setDescription("");
      removeImage();
      setSelectedCity("");
      setCustomCity("");
      setVenue("");
      setStartDate("");
      setEndDate("");
      setOfficialPrice("");
      setOrganizerPrice("");
      setOmPhone("");
      onCreated?.();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ===== SECTION 1 : QUOI ? ===== */}
      <section className="neo-card rounded-2xl p-5">
        <StepHeader n={1} label="Quoi ?" />

        <div className="space-y-4">
          {/* Titre */}
          <label className="block text-sm">
            <span className="font-medium">
              Titre de l&apos;evenement
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Ex: Concert live, Soiree VIP, Conference..."
              className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
            />
          </label>

          {/* Description */}
          <label className="block text-sm">
            <span className="font-medium">
              Description{" "}
              <span className="font-normal text-black/40">(optionnel)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Programme, details pratiques, dress code..."
              className="mt-1 w-full resize-none neo-input rounded-xl px-4 py-3 text-base"
            />
          </label>

          {/* Affiche — zone de depot visuelle */}
          <div>
            <span className="text-sm font-medium">
              Affiche de l&apos;evenement
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImage}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative mt-2 overflow-hidden rounded-2xl border border-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Apercu affiche"
                  className="max-h-72 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                  aria-label="Supprimer"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow transition-colors hover:bg-white"
                >
                  Changer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neo-teal/20 bg-white py-12 text-black/50 transition-colors hover:border-neo-teal/40 hover:bg-neo-teal/[0.02]"
              >
                <svg
                  className="h-10 w-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path
                    d="m21 15-5-5L5 21"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-medium">
                  Ajoutez votre affiche
                </span>
                <span className="text-xs">Formats image, max 5 Mo</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===== SECTION 2 : OU & QUAND ? ===== */}
      <section className="neo-card rounded-2xl p-5">
        <StepHeader n={2} label="Ou & Quand ?" />

        <div className="space-y-4">
          {/* Ville — pills */}
          <div>
            <span className="text-sm font-medium">Ville</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR_CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCity(c)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCity === c
                      ? "border-neo-teal neo-gradient text-white"
                      : "border-black/10 bg-white text-black/70 hover:border-neo-teal/30"
                  }`}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedCity("__custom__")}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCity === "__custom__"
                    ? "border-neo-teal neo-gradient text-white"
                    : "border-black/10 bg-white text-black/70 hover:border-neo-teal/30"
                }`}
              >
                Autre ville
              </button>
            </div>
            {selectedCity === "__custom__" && (
              <input
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                required
                maxLength={120}
                placeholder="Nom de la ville"
                className="mt-2 w-full neo-input rounded-xl px-4 py-3 text-sm"
                autoFocus
              />
            )}
          </div>

          {/* Lieu precis */}
          <label className="block text-sm">
            <span className="font-medium">
              Lieu precis{" "}
              <span className="font-normal text-black/40">(optionnel)</span>
            </span>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              maxLength={200}
              placeholder="Ex: Stade du 4 Aout, Salle Katr Pattes..."
              className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
            />
          </label>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Debut</span>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">
                Fin{" "}
                <span className="font-normal text-black/40">(optionnel)</span>
              </span>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
              />
            </label>
          </div>
        </div>
      </section>

      {/* ===== SECTION 3 : COMBIEN ? ===== */}
      <section className="neo-card rounded-2xl p-5">
        <StepHeader n={3} label="Combien ?" />

        <div className="space-y-4">
          {/* Prix */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Prix officiel (F CFA)</span>
              <input
                type="number"
                value={officialPrice}
                onChange={(e) => setOfficialPrice(e.target.value)}
                min={1}
                step={1}
                required
                inputMode="numeric"
                placeholder="3000"
                className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">
                Prix promo organisateur (F CFA)
              </span>
              <input
                type="number"
                value={organizerPrice}
                onChange={(e) => setOrganizerPrice(e.target.value)}
                min={1}
                step={1}
                required
                inputMode="numeric"
                placeholder="2000"
                className="mt-1 w-full neo-input rounded-xl px-4 py-3 text-base"
              />
            </label>
          </div>

          {/* Calculateur temps reel */}
          {showCalculator && (
            <div className="space-y-2 rounded-xl border border-neo-teal/20 bg-gradient-to-br from-neo-teal/5 to-neo-green/5 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neo-teal-dark">
                  Prix paye par le client
                </span>
                <span className="font-bold text-neo-teal-dark">
                  {clientPays.toLocaleString("fr-FR")} F CFA
                </span>
              </div>
              {platformDiscountPercent > 0 && (
                <p className="text-xs text-neo-teal">
                  Incluant -{platformDiscountPercent}% de remise plateforme
                </p>
              )}
              <div className="flex items-center justify-between border-t border-neo-teal/15 pt-2">
                <span className="text-neo-teal-dark">
                  Votre gain par ticket
                </span>
                <span className="font-bold text-neo-teal-dark">
                  {organizerGain.toLocaleString("fr-FR")} F CFA
                </span>
              </div>
              <p className="text-xs text-neo-teal">
                Apres commission plateforme de 10%
              </p>
            </div>
          )}

          {priceError && (
            <p className="text-xs text-red-600">
              Le prix promo ne peut pas depasser le prix officiel.
            </p>
          )}

          {/* Orange Money */}
          <div className="border-t border-black/10 pt-4">
            <label className="block text-sm">
              <span className="font-medium">
                N&deg; Orange Money pour recevoir vos fonds
              </span>
              <div className="mt-1">
                <PhoneInput
                  value={omPhone}
                  onChange={setOmPhone}
                  required
                  placeholder="56636039"
                />
              </div>
              <p className="mt-1.5 text-xs text-black/50">
                Assurez-vous que ce numero est correct pour vos reversements.
              </p>
            </label>
          </div>
        </div>
      </section>

      {/* ===== Erreur / Succes ===== */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {createdEvent && (
        <div className="rounded-xl border border-neo-teal/20 bg-gradient-to-r from-neo-teal/5 to-neo-green/5 px-4 py-3 text-sm text-neo-teal-dark">
          <p className="font-medium">
            Evenement publie : {createdEvent.title}
          </p>
          <p className="mt-1">
            Date : {new Date(createdEvent.date).toLocaleString("fr-FR")}
          </p>
        </div>
      )}

      {/* ===== Bouton publier ===== */}
      <button
        type="submit"
        disabled={isSubmitting || priceError}
        className="neo-btn w-full rounded-2xl py-4 text-base shadow-lg"
      >
        {isSubmitting ? "Publication en cours..." : "Publier l'evenement"}
      </button>
      <p className="text-center text-xs text-black/40">
        Votre evenement sera visible des validation.
      </p>
    </form>
  );
}

/* ---- Petit composant step header ---- */
function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="neo-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
        {n}
      </span>
      <h3 className="text-base font-bold">{label}</h3>
    </div>
  );
}
