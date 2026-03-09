"use client";

import { useEffect, useState, useMemo } from "react";
import { showToast, ToastContainer } from "./toast";

type ClosureEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  effectiveEndAt: string;
  organizerPhone: string | null;
  escrowAmount: number;
  pendingPayoutAmount: number;
  paidPayoutAmount: number;
  netToPay: number;
};

type PayoutItem = {
  id: string;
  eventId: string;
  eventTitle?: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  paidAt: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value) + " F CFA";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    pending: "bg-orange-100 text-orange-800",
    rejected: "bg-red-100 text-red-800",
  };
  const label: Record<string, string> = {
    paid: "Payé",
    pending: "En attente",
    rejected: "Rejeté",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

/* ── SVG icon helpers ── */
function IconBanknote({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

export function ClosureDashboardPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ClosureEvent[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [isSubmittingPayoutId, setIsSubmittingPayoutId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({
    totalEscrowAmount: 0,
    pendingPayoutAmount: 0,
    paidPayoutAmount: 0,
    gainAmount: 0,
  });

  /* ── Data loading ── */
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/closure", { cache: "no-store" });
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        events?: ClosureEvent[];
        payouts?: PayoutItem[];
        summary?: typeof summary;
      };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Chargement impossible.");
        return;
      }
      setEvents(payload.events ?? []);
      setPayouts(payload.payouts ?? []);
      setSummary(payload.summary ?? { totalEscrowAmount: 0, pendingPayoutAmount: 0, paidPayoutAmount: 0, gainAmount: 0 });
    } catch {
      setError("Erreur réseau pendant le chargement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void fetchData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Payout actions ── */
  const handlePayout = async (payoutId: string, action: "validate" | "reject") => {
    setIsSubmittingPayoutId(payoutId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payouts/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        showToast(payload.error ?? `${action === "validate" ? "Validation" : "Rejet"} impossible.`, "error");
        return;
      }
      showToast(action === "validate" ? "Versement validé !" : "Versement rejeté.", "success");
      await fetchData();
    } catch {
      showToast("Erreur réseau.", "error");
    } finally {
      setIsSubmittingPayoutId(null);
    }
  };

  /* ── Filtered data ── */
  const q = search.toLowerCase().trim();
  const filteredEvents = useMemo(
    () => (q ? events.filter((e) => e.title.toLowerCase().includes(q) || (e.organizerPhone ?? "").includes(q)) : events),
    [events, q],
  );
  const filteredPayouts = useMemo(
    () =>
      q
        ? payouts.filter(
            (p) =>
              (p.eventTitle ?? "").toLowerCase().includes(q) ||
              (p.receiverName ?? "").toLowerCase().includes(q) ||
              (p.receiverPhone ?? "").includes(q),
          )
        : payouts,
    [payouts, q],
  );

  return (
    <section className="mt-5 grid gap-5">
      <ToastContainer />

      {/* ── 2×2 KPI grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconBanknote className="h-4 w-4 text-black/40" />
            <p className="text-[11px] font-medium text-black/50">Total Fonds</p>
          </div>
          <p className="mt-2 text-lg font-bold leading-tight">{formatMoney(summary.totalEscrowAmount)}</p>
        </article>

        <article className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-orange-500" />
            <p className="text-[11px] font-medium text-orange-600">En Attente</p>
          </div>
          <p className="mt-2 text-lg font-bold leading-tight text-orange-700">{formatMoney(summary.pendingPayoutAmount)}</p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconChart className="h-4 w-4 text-emerald-500" />
            <p className="text-[11px] font-medium text-emerald-600">Gain Dispo</p>
          </div>
          <p className="mt-2 text-lg font-bold leading-tight text-emerald-700">{formatMoney(summary.gainAmount)}</p>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-black/40" />
            <p className="text-[11px] font-medium text-black/50">Événements</p>
          </div>
          <p className="mt-2 text-lg font-bold leading-tight">{events.length}</p>
        </article>
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un événement, organisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-black/35 focus:border-black/25"
        />
      </div>

      {isLoading && <p className="text-center text-sm text-black/50">Chargement...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* ── Events list cards ── */}
      {!isLoading && !error && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-black/70">Événements suivis</h2>
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-black/50">Aucun événement trouvé.</p>
          ) : (
            <div className="grid gap-2.5">
              {filteredEvents.map((event) => (
                <article key={event.id} className="flex items-start justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{event.title}</p>
                    <p className="mt-1 text-xs text-black/50">
                      {new Date(event.effectiveEndAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      {event.organizerPhone ? ` · ${event.organizerPhone}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60">
                      <span>Séquestre : {formatMoney(event.escrowAmount)}</span>
                      <span>Reversé : {formatMoney(event.paidPayoutAmount)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-black/40">À reverser</p>
                    <p className="text-base font-bold text-emerald-700">{formatMoney(event.netToPay)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payouts list cards ── */}
      {!isLoading && !error && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-black/70">Historique reversements</h2>
          {filteredPayouts.length === 0 ? (
            <p className="text-sm text-black/50">Aucune demande de reversement.</p>
          ) : (
            <div className="grid gap-2.5">
              {filteredPayouts.map((payout) => (
                <article key={payout.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{payout.eventTitle ?? payout.eventId}</p>
                      <p className="mt-1 text-xs text-black/50">
                        {new Date(payout.requestedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {payout.receiverName ? ` · ${payout.receiverName}` : ""}
                        {payout.receiverPhone ? ` (${payout.receiverPhone})` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={payout.status} />
                      <p className="text-base font-bold">{formatMoney(payout.amount)}</p>
                    </div>
                  </div>
                  {payout.paidAt && (
                    <p className="mt-1.5 text-[11px] text-black/40">Payé le {new Date(payout.paidAt).toLocaleDateString("fr-FR")}</p>
                  )}
                  {payout.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => { void handlePayout(payout.id, "validate"); }}
                        disabled={isSubmittingPayoutId === payout.id}
                        className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handlePayout(payout.id, "reject"); }}
                        disabled={isSubmittingPayoutId === payout.id}
                        className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
