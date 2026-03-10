"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/phone-input";

type DashboardEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  sourceStatus: "draft" | "published" | "ended" | "cancelled";
  lifecycleStatus: "brouillon" | "annule" | "en_cours" | "termine";
  ticketsSold: number;
  organizerFunds: number;
  payoutPendingAmount: number;
  payoutPaidAmount: number;
  payoutRequestableAmount: number;
  canRequestPayout: boolean;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

function formatSourceStatus(status: DashboardEvent["sourceStatus"]) {
  if (status === "published") {
    return "Publie";
  }

  if (status === "ended") {
    return "Termine";
  }

  if (status === "cancelled") {
    return "Annule";
  }

  return "Brouillon";
}

function formatLifecycleStatus(status: DashboardEvent["lifecycleStatus"]) {
  if (status === "en_cours") {
    return "En cours";
  }

  if (status === "termine") {
    return "Termine";
  }

  if (status === "annule") {
    return "Annule";
  }

  return "Brouillon";
}

export function OrganizerEventsOverview({
  refreshKey,
  onActionComplete,
}: {
  refreshKey: number;
  onActionComplete?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submittingEventId, setSubmittingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [payoutModalEvent, setPayoutModalEvent] = useState<DashboardEvent | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setFeedback(null);

      try {
        const response = await fetch("/api/organizer/dashboard", { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          error?: string;
          events?: DashboardEvent[];
        };

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Chargement impossible.");
          return;
        }

        setEvents(payload.events ?? []);
      } catch {
        setError("Erreur reseau pendant le chargement du dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [refreshKey]);

  const requestPayout = async (eventId: string, targetName: string, targetPhone: string) => {
    setSubmittingEventId(eventId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/organizer/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          receiverName: targetName,
          receiverPhone: targetPhone,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Demande de reversement impossible.");
        return;
      }

      setFeedback(payload.message ?? "Votre demande de versement a ete effectuee.");
      setPayoutModalEvent(null);
      setReceiverName("");
      setReceiverPhone("");
      onActionComplete?.();
    } catch {
      setError("Erreur reseau pendant la demande de reversement.");
    } finally {
      setSubmittingEventId(null);
    }
  };

  const openPayoutModal = (event: DashboardEvent) => {
    setError(null);
    setFeedback(null);
    setPayoutModalEvent(event);
    setReceiverName("");
    setReceiverPhone("");
  };

  const closePayoutModal = () => {
    if (submittingEventId) {
      return;
    }

    setPayoutModalEvent(null);
  };

  return (
    <section className="w-full rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mes evenements</h2>
      </div>

      {isLoading ? <p className="mt-4 text-sm text-black/60">Chargement...</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {feedback ? <p className="mt-4 text-sm text-emerald-700">{feedback}</p> : null}

      {!isLoading && !error && events.length === 0 ? (
        <p className="mt-4 text-sm text-black/70">Aucun evenement cree pour le moment.</p>
      ) : null}

      {!isLoading && !error && events.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:hidden">
            {events.map((event) => (
              <article key={event.id} className="rounded-xl border border-black/10 bg-[#fffdf8] p-3">
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="mt-1 text-xs text-black/60">
                  {new Date(event.date).toLocaleString("fr-FR")}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-black/60">Tickets</dt>
                    <dd className="font-medium">{event.ticketsSold}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">Statut choisi</dt>
                    <dd className="font-medium">{formatSourceStatus(event.sourceStatus)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">Cycle reel</dt>
                    <dd className="font-medium">{formatLifecycleStatus(event.lifecycleStatus)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">Fonds</dt>
                    <dd className="font-medium">{formatMoney(event.organizerFunds)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">Disponible</dt>
                    <dd className="font-medium">{formatMoney(event.payoutRequestableAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">En attente</dt>
                    <dd className="font-medium">{formatMoney(event.payoutPendingAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/60">Deja reverse</dt>
                    <dd className="font-medium">{formatMoney(event.payoutPaidAmount)}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/organizer/events/${event.id}/edit`}
                      className="rounded-lg border border-black/20 px-3 py-2 text-xs font-medium"
                    >
                      Modifier evenement
                    </Link>
                    {event.canRequestPayout ? (
                      <button
                        type="button"
                        onClick={() => {
                          openPayoutModal(event);
                        }}
                        disabled={submittingEventId === event.id}
                        className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {submittingEventId === event.id ? "Envoi..." : "Demander versement"}
                      </button>
                    ) : (
                      <p className="text-xs text-black/50">Versement indisponible</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/70">
                <th className="px-2 py-2 font-medium">Evenement</th>
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Tickets vendus</th>
                <th className="px-2 py-2 font-medium">Fonds organisateur</th>
                <th className="px-2 py-2 font-medium">Reversement en attente</th>
                <th className="px-2 py-2 font-medium">Deja reverse</th>
                <th className="px-2 py-2 font-medium">Disponible</th>
                <th className="px-2 py-2 font-medium">Statut choisi</th>
                <th className="px-2 py-2 font-medium">Cycle reel</th>
                <th className="px-2 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-black/5">
                  <td className="px-2 py-3">{event.title}</td>
                  <td className="px-2 py-3">{new Date(event.date).toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-3">{event.ticketsSold}</td>
                  <td className="px-2 py-3">{formatMoney(event.organizerFunds)}</td>
                  <td className="px-2 py-3">{formatMoney(event.payoutPendingAmount)}</td>
                  <td className="px-2 py-3">{formatMoney(event.payoutPaidAmount)}</td>
                  <td className="px-2 py-3">{formatMoney(event.payoutRequestableAmount)}</td>
                  <td className="px-2 py-3">{formatSourceStatus(event.sourceStatus)}</td>
                  <td className="px-2 py-3">{formatLifecycleStatus(event.lifecycleStatus)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/organizer/events/${event.id}/edit`}
                        className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium"
                      >
                        Modifier
                      </Link>
                      {event.canRequestPayout ? (
                        <button
                          type="button"
                          onClick={() => {
                            openPayoutModal(event);
                          }}
                          disabled={submittingEventId === event.id}
                          className="rounded-lg bg-black px-3 py-1 text-white disabled:opacity-60"
                        >
                          {submittingEventId === event.id ? "Envoi..." : "Demander versement"}
                        </button>
                      ) : (
                        <span className="text-black/50">Indisponible</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {payoutModalEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Demander un versement</h3>
            <p className="mt-2 text-sm text-black/70">
              Evenement: <span className="font-medium">{payoutModalEvent.title}</span>
            </p>
            <p className="mt-1 text-sm text-black/70">
              Montant a verser: <span className="font-semibold">{formatMoney(payoutModalEvent.payoutRequestableAmount)}</span>
            </p>

            <label className="mt-4 grid gap-1 text-sm">
              <span className="font-medium">Nom du receveur</span>
              <input
                type="text"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder="Ex: Souleymane Ouedraogo"
                className="neo-input rounded-xl px-3 py-2"
              />
            </label>

            <label className="mt-3 grid gap-1 text-sm">
              <span className="font-medium">Numero du receveur</span>
              <PhoneInput
                value={receiverPhone}
                onChange={setReceiverPhone}
              />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePayoutModal}
                className="rounded-xl border border-black/20 px-3 py-2 text-xs font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  void requestPayout(
                    payoutModalEvent.id,
                    receiverName.trim(),
                    `+226${receiverPhone.trim()}`,
                  );
                }}
                disabled={submittingEventId === payoutModalEvent.id}
                className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {submittingEventId === payoutModalEvent.id ? "Envoi..." : "Confirmer la demande"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
