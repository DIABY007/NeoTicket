"use client";

import { useEffect, useState } from "react";

type PromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type Affiliate = {
  id: string;
  ambassador_name: string;
  ref_code: string;
  sales_count: number;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const siteUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

export function MarketingPanel({ eventId }: { eventId: string }) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Promo form
  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoExpires, setPromoExpires] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  // Affiliate form
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateRef, setAffiliateRef] = useState("");
  const [affiliateSubmitting, setAffiliateSubmitting] = useState(false);

  // Copied link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/organizer/marketing?eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        eventSlug?: string | null;
        promoCodes?: PromoCode[];
        affiliates?: Affiliate[];
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Chargement impossible.");
        return;
      }

      setPromoCodes(payload.promoCodes ?? []);
      setAffiliates(payload.affiliates ?? []);
      if (payload.eventSlug) setEventSlug(payload.eventSlug);
    } catch {
      setError("Erreur reseau.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [eventId]);

  const createPromoCode = async () => {
    setPromoSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/organizer/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_promo",
          eventId,
          code: promoCode,
          discountPercent: Number(promoPercent),
          maxUses: Number(promoMaxUses),
          expiresAt: promoExpires || undefined,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Creation impossible.");
        return;
      }

      setFeedback("Code promo cree.");
      setPromoCode("");
      setPromoPercent("");
      setPromoMaxUses("");
      setPromoExpires("");
      await loadData();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setPromoSubmitting(false);
    }
  };

  const togglePromo = async (promoCodeId: string, isActive: boolean) => {
    setError(null);
    setFeedback(null);

    const response = await fetch("/api/organizer/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_promo",
        eventId,
        promoCodeId,
        isActive,
      }),
    });

    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
    };

    if (!response.ok || !payload.success) {
      setError(payload.error ?? "Mise a jour impossible.");
      return;
    }

    await loadData();
  };

  const createAffiliate = async () => {
    setAffiliateSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/organizer/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_affiliate",
          eventId,
          ambassadorName: affiliateName,
          refCode: affiliateRef,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Creation impossible.");
        return;
      }

      setFeedback("Ambassadeur cree.");
      setAffiliateName("");
      setAffiliateRef("");
      await loadData();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setAffiliateSubmitting(false);
    }
  };

  const buildAffiliateLink = (refCode: string) => {
    if (eventSlug) {
      return `${siteUrl}/e/${eventSlug}?ref=${refCode}`;
    }
    return `${siteUrl}/events/${eventId}?ref=${refCode}`;
  };

  const copyLink = async (refCode: string, affiliateId: string) => {
    const link = buildAffiliateLink(refCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(affiliateId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = link;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(affiliateId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-black/60">Chargement marketing...</p>;
  }

  return (
    <div className="grid gap-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}

      {/* Section 1: Codes Promo */}
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Codes Promo</h3>
        <p className="mt-1 text-xs text-black/60">
          Creez des codes de reduction pour cet evenement.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Code</span>
            <input
              type="text"
              placeholder="Ex: PROMO20"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Reduction (%)</span>
            <input
              type="number"
              min="1"
              max="100"
              placeholder="20"
              value={promoPercent}
              onChange={(e) => setPromoPercent(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Utilisations max</span>
            <input
              type="number"
              min="1"
              placeholder="100"
              value={promoMaxUses}
              onChange={(e) => setPromoMaxUses(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Expiration (optionnel)</span>
            <input
              type="datetime-local"
              value={promoExpires}
              onChange={(e) => setPromoExpires(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => { void createPromoCode(); }}
          disabled={promoSubmitting || !promoCode.trim() || !promoPercent || !promoMaxUses}
          className="neo-btn mt-3 rounded-xl px-4 py-2 text-sm"
        >
          {promoSubmitting ? "Creation..." : "Creer le code promo"}
        </button>

        {promoCodes.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-black/70">
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Reduction</th>
                  <th className="px-2 py-2 font-medium">Utilisations</th>
                  <th className="px-2 py-2 font-medium">Expiration</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((pc) => (
                  <tr key={pc.id} className="border-b border-black/5">
                    <td className="px-2 py-2 font-mono text-xs font-bold">{pc.code}</td>
                    <td className="px-2 py-2">-{pc.discount_percent}%</td>
                    <td className="px-2 py-2">
                      {pc.current_uses}/{pc.max_uses}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {pc.expires_at ? formatDate(pc.expires_at) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          pc.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {pc.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => { void togglePromo(pc.id, !pc.is_active); }}
                        className="rounded-lg border border-black/15 px-2 py-1 text-xs transition hover:border-neo-teal/30"
                      >
                        {pc.is_active ? "Desactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-black/50">Aucun code promo cree.</p>
        )}
      </section>

      {/* Section 2: Liens ambassadeurs */}
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Liens Ambassadeurs</h3>
        <p className="mt-1 text-xs text-black/60">
          Generez des liens de suivi pour vos ambassadeurs.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Nom de l&apos;ambassadeur</span>
            <input
              type="text"
              placeholder="Ex: Moussa"
              value={affiliateName}
              onChange={(e) => setAffiliateName(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Code referent</span>
            <input
              type="text"
              placeholder="Ex: moussa"
              value={affiliateRef}
              onChange={(e) => setAffiliateRef(e.target.value)}
              className="neo-input rounded-xl px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => { void createAffiliate(); }}
          disabled={affiliateSubmitting || !affiliateName.trim() || !affiliateRef.trim()}
          className="neo-btn mt-3 rounded-xl px-4 py-2 text-sm"
        >
          {affiliateSubmitting ? "Creation..." : "Creer le lien ambassadeur"}
        </button>

        {affiliates.length > 0 ? (
          <div className="mt-4 space-y-2">
            {affiliates.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/8 bg-[#fffdf8] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.ambassador_name}</p>
                  <p className="truncate text-xs text-black/50 font-mono">
                    {buildAffiliateLink(a.ref_code)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { void copyLink(a.ref_code, a.id); }}
                  className="rounded-lg border border-black/15 px-3 py-1 text-xs transition hover:border-neo-teal/30"
                >
                  {copiedId === a.id ? "Copie !" : "Copier le lien"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-black/50">Aucun ambassadeur cree.</p>
        )}
      </section>

      {/* Section 3: Top Ambassadeurs */}
      {affiliates.length > 0 ? (
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Top Ambassadeurs</h3>
          <p className="mt-1 text-xs text-black/60">
            Classement par nombre de ventes generees.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-black/70">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Ambassadeur</th>
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Ventes</th>
                </tr>
              </thead>
              <tbody>
                {affiliates
                  .sort((a, b) => b.sales_count - a.sales_count)
                  .map((a, index) => (
                    <tr key={a.id} className="border-b border-black/5">
                      <td className="px-2 py-2 font-medium">{index + 1}</td>
                      <td className="px-2 py-2">{a.ambassador_name}</td>
                      <td className="px-2 py-2 font-mono text-xs">{a.ref_code}</td>
                      <td className="px-2 py-2 font-semibold">{a.sales_count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[11px] text-black/40 leading-relaxed">
            ⚠️ NeoTicket fournit uniquement le suivi statistique des clics et des ventes. Le
            règlement financier des commissions est un accord privé et de la responsabilité
            exclusive de l&apos;organisateur.
          </p>
        </section>
      ) : null}
    </div>
  );
}
