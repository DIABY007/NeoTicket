"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/phone-input";

type Props = {
  eventId: string;
  officialPrice?: number;
  finalPrice: number;
  eventDate: string;
  eventStatus: "draft" | "published" | "ended" | "cancelled";
  refCode?: string;
};

function normalizeOmPhone(value: string) {
  const digitsOnly = value.replace(/\D+/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("226")) return `+${digitsOnly}`;
  return `+226${digitsOnly}`;
}

const REF_STORAGE_KEY = "neoticket_ref";
const PROMO_STORAGE_KEY = "neoticket_promo";

function persistRef(eventId: string, ref: string) {
  try {
    sessionStorage.setItem(`${REF_STORAGE_KEY}_${eventId}`, ref);
  } catch { /* storage unavailable */ }
}

function getPersistedRef(eventId: string): string | null {
  try {
    return sessionStorage.getItem(`${REF_STORAGE_KEY}_${eventId}`);
  } catch { return null; }
}

export function BuyTicketButton({ eventId, officialPrice, finalPrice, eventDate, eventStatus, refCode }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    promoCodeId: string;
    code: string;
    discountPercent: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Ref tracking: persist on mount
  useEffect(() => {
    if (refCode) {
      persistRef(eventId, refCode);
    }
  }, [eventId, refCode]);

  const activeRef = refCode || getPersistedRef(eventId);

  // Compute promo-adjusted price
  const baseFinalPrice = finalPrice;
  const promoDiscountedPrice = promoResult
    ? Math.round(baseFinalPrice * (1 - promoResult.discountPercent / 100))
    : baseFinalPrice;
  const displayPrice = Math.max(0, promoDiscountedPrice);

  const omPhonePreview = normalizeOmPhone(phoneInput);
  const isFreeEvent = Math.round(displayPrice) <= 0;

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
          promoCodeId: promoResult?.promoCodeId ?? null,
          refCode: activeRef ?? null,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        flow?: "ussd_manual" | "free_ticket";
        transactionId?: string;
        ticketId?: string;
        finalAmount?: number;
        supportPhone?: string;
      };

      if (!response.ok || !payload.success || !payload.transactionId) {
        setError(payload.error ?? "Initiation paiement impossible.");
        return;
      }

      if (payload.flow === "free_ticket") {
        setIsModalOpen(false);
        router.push("/?tab=profile");
        return;
      }

      const ussdAmount = Math.round(payload.finalAmount ?? displayPrice);
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

  const validatePromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setPromoValidating(true);
    setPromoError(null);
    setPromoResult(null);

    try {
      const response = await fetch(
        `/api/events/promo/validate?eventId=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}`,
      );
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        promoCodeId?: string;
        code?: string;
        discountPercent?: number;
      };

      if (!response.ok || !payload.success) {
        setPromoError(payload.error ?? "Code promo invalide.");
        return;
      }

      setPromoResult({
        promoCodeId: payload.promoCodeId!,
        code: payload.code!,
        discountPercent: payload.discountPercent!,
      });
    } catch {
      setPromoError("Erreur reseau lors de la verification.");
    } finally {
      setPromoValidating(false);
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
          {isFreeEvent ? "Recuperer mon ticket gratuit" : "Acheter ticket"}
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
            <h3 className="text-xl font-bold">
              {isFreeEvent ? "Reservation gratuite" : "Paiement Orange Money"}
            </h3>
            <p className="mt-2 text-sm text-black/70">
              {isFreeEvent
                ? "Entrez vos informations pour recevoir instantanement votre ticket QR sur WhatsApp."
                : "Entrez vos informations, puis composez le code USSD pour le depot."}
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
              <span className="font-medium">Numero WhatsApp</span>
              <PhoneInput
                value={phoneInput}
                onChange={setPhoneInput}
              />
              <span className="text-xs text-black/60">Numero envoye (E.164): {omPhonePreview || "(vide)"}</span>
            </label>

            {baseFinalPrice > 0 ? (
              <div className="mt-3 grid gap-1 text-sm">
                <span className="font-medium">Code Promo</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: PROMO20"
                    value={promoInput}
                    onChange={(event) => {
                      setPromoInput(event.target.value);
                      if (promoResult) {
                        setPromoResult(null);
                        setPromoError(null);
                      }
                    }}
                    className="neo-input flex-1 rounded-xl px-3 py-2"
                    disabled={!!promoResult}
                  />
                  {promoResult ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoResult(null);
                        setPromoError(null);
                        setPromoInput("");
                      }}
                      className="rounded-xl border border-black/8 px-3 py-2 text-xs hover:border-red-300 transition"
                    >
                      Retirer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { void validatePromoCode(); }}
                      disabled={promoValidating || !promoInput.trim()}
                      className="neo-btn rounded-xl px-3 py-2 text-xs"
                    >
                      {promoValidating ? "..." : "Appliquer"}
                    </button>
                  )}
                </div>
                {promoError ? (
                  <p className="text-xs text-red-600">{promoError}</p>
                ) : null}
                {promoResult ? (
                  <p className="text-xs font-medium text-neo-teal">
                    -{promoResult.discountPercent}% applique avec {promoResult.code}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="mt-2 text-sm text-black/70">
              {isFreeEvent ? (
                <>
                  Tarif: <span className="font-semibold text-neo-teal">Gratuit</span>
                </>
              ) : (
                <>
                  {promoResult && displayPrice < baseFinalPrice ? (
                    <>
                      <span className="text-black/50 line-through">{Math.round(baseFinalPrice)} F CFA</span>{" "}
                    </>
                  ) : null}
                  Montant final a payer: <span className="font-semibold">{Math.round(displayPrice)} F CFA</span>
                </>
              )}
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
                {isSubmitting
                  ? "Traitement..."
                  : isFreeEvent
                    ? "Confirmer et recevoir mon ticket"
                    : "Lancer paiement USSD"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
