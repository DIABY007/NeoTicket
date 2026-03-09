"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/phone-input";

type Props = {
  eventId: string;
  finalPrice: number;
  eventDate: string;
  eventStatus: "draft" | "published" | "ended" | "cancelled";
};

function normalizeOmPhone(value: string) {
  const digitsOnly = value.replace(/\D+/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("226")) return `+${digitsOnly}`;
  return `+226${digitsOnly}`;
}

export function BuyTicketButton({ eventId, finalPrice, eventDate, eventStatus }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const omPhonePreview = normalizeOmPhone(phoneInput);

  const eventTimestamp = new Date(eventDate).getTime();
  const isFutureEvent = Number.isFinite(eventTimestamp) && eventTimestamp > Date.now();
  const canBuy = eventStatus === "published" && isFutureEvent;

  const disabledReason =
    eventStatus !== "published"
      ? "Vente indisponible: evenement non publie."
      : !isFutureEvent
        ? "Vente indisponible: evenement deja passe."
        : null;

  const startPayment = async () => {
    if (!omPhonePreview) {
      setError("Veuillez saisir un numero Orange Money valide.");
      return;
    }

    const merchant = "56636039";

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          buyerPhone: omPhonePreview,
          buyerName,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        transactionId?: string;
        finalAmount?: number;
        supportPhone?: string;
      };

      if (!response.ok || !payload.success || !payload.transactionId) {
        setError(payload.error ?? "Initiation paiement impossible.");
        return;
      }

      const ussdAmount = Math.round(payload.finalAmount ?? finalPrice);
      const ussdCode = `*144*2*1*${merchant}*${ussdAmount}#`;
      window.location.href = `tel:${encodeURIComponent(ussdCode)}`;

      setIsModalOpen(false);
      const supportPhone = payload.supportPhone ?? "+22656636039";
      router.push(`/buyer/payment-pending?phone=${encodeURIComponent(supportPhone)}`);
    } catch {
      setError("Erreur reseau pendant l'initiation du paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid justify-items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          disabled={!canBuy}
          title={disabledReason ?? "Acheter ce ticket"}
          className="neo-btn rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed"
        >
          Acheter ticket
        </button>
        {!canBuy && disabledReason ? (
          <p className="text-xs text-black/60" role="status">
            {disabledReason}
          </p>
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold">Paiement Orange Money</h3>
            <p className="mt-2 text-sm text-black/70">
              Entrez vos informations, puis composez le code USSD pour le depot.
            </p>

            <label className="mt-4 grid gap-1 text-sm">
              <span className="font-medium">Nom complet</span>
              <input
                type="text"
                placeholder="Ex: Awa Ouedraogo"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                className="neo-input rounded-xl px-3 py-3"
              />
            </label>

            <label className="mt-3 grid gap-1 text-sm">
              <span className="font-medium">Numero Orange Money</span>
              <PhoneInput
                value={phoneInput}
                onChange={setPhoneInput}
              />
              <span className="text-xs text-black/60">Numero envoye (E.164): {omPhonePreview || "(vide)"}</span>
            </label>

            <p className="mt-2 text-sm text-black/70">
              Montant final a payer: <span className="font-semibold">{Math.round(finalPrice)} F CFA</span>
            </p>

            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-black/8 px-4 py-2 text-sm hover:border-neo-teal/30 transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  void startPayment();
                }}
                disabled={isSubmitting}
                className="neo-btn rounded-xl px-4 py-2 text-sm"
              >
                {isSubmitting ? "Traitement..." : "Lancer paiement USSD"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
