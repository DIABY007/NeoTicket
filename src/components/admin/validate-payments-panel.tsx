"use client";

import { useEffect, useState } from "react";

type PendingTx = {
  id: string;
  eventId: string;
  buyerName?: string;
  buyerPhone: string;
  amount: number;
  createdAt: string;
  eventTitle?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value) + " F CFA";
}

export function ValidatePaymentsPanel() {
  const [items, setItems] = useState<PendingTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/payments/pending", { cache: "no-store" });
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        transactions?: PendingTx[];
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Chargement impossible.");
        return;
      }

      setItems(payload.transactions ?? []);
    } catch {
      setError("Erreur reseau pendant le chargement des paiements.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const validate = async (transactionId: string) => {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/payments/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });

    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      message?: string;
      whatsappDelivered?: boolean;
      whatsappError?: string | null;
    };

    if (!response.ok || !payload.success) {
      setError(payload.error ?? "Validation impossible.");
      return;
    }

    if (payload.whatsappDelivered === false) {
      setError(
        `Paiement valide, mais envoi WhatsApp du QR non confirme: ${
          payload.whatsappError ?? "cause inconnue"
        }`,
      );
    } else {
      setFeedback(payload.message ?? "Paiement valide.");
    }
    await load();
  };

  const reject = async (transactionId: string) => {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/payments/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });

    const payload = (await response.json()) as { success: boolean; error?: string; message?: string };

    if (!response.ok || !payload.success) {
      setError(payload.error ?? "Rejet impossible.");
      return;
    }

    setFeedback(payload.message ?? "Paiement rejete.");
    await load();
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Validation Paiements</h1>
      <p className="mt-2 text-sm text-black/70">Validez manuellement les depots Orange Money recus par SMS.</p>

      {feedback ? <p className="mt-4 text-sm text-emerald-700">{feedback}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {isLoading ? <p className="mt-4 text-sm text-black/60">Chargement...</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className="mt-4 text-sm text-black/70">Aucune transaction en attente.</p>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/70">
                <th className="px-2 py-2">Evenement</th>
                <th className="px-2 py-2">Nom</th>
                <th className="px-2 py-2">Numero</th>
                <th className="px-2 py-2">Montant final</th>
                <th className="px-2 py-2">Heure</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-black/5">
                  <td className="px-2 py-3">{item.eventTitle ?? item.eventId}</td>
                  <td className="px-2 py-3">{item.buyerName ?? "Client"}</td>
                  <td className="px-2 py-3">{item.buyerPhone}</td>
                  <td className="px-2 py-3">{formatMoney(item.amount)}</td>
                  <td className="px-2 py-3">{new Date(item.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-white"
                        onClick={() => {
                          void validate(item.id);
                        }}
                      >
                        Valider le paiement
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-3 py-1 text-white"
                        onClick={() => {
                          void reject(item.id);
                        }}
                      >
                        Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
