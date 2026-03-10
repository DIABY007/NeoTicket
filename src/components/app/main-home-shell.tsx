"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { LoginPhoneForm } from "@/components/auth/login-phone-form";
import { EventCatalog } from "@/components/buyer/event-catalog";
import { NeoTicketLogo } from "@/components/neo-ticket-logo";
import { PhoneInput } from "@/components/phone-input";
import { AppRole } from "@/lib/auth/roles";

type BuyerEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  price: number;
  official_price: number;
  organizer_price: number;
  platform_discount_percent: number;
  organizer_discount_percent: number;
  final_price: number;
  city: string | null;
  image_url: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

type PortfolioTicket = {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  eventCity: string | null;
  price: number;
  ticketStatus: "paid" | "scanned";
  scannedAt: string | null;
  paymentConfirmedAt: string | null;
};

type PortfolioTransaction = {
  transactionId: string;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  amount: number;
  status: "pending" | "success";
  createdAt: string;
  paidAt: string | null;
};

type HomeTab = "feed" | "profile";
type ProfileSubTab = "tickets" | "events";

type OrganizerEvent = {
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

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21c1.8-3.3 4.4-5 8-5s6.2 1.7 8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCalendarSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M2 9V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function hasCreatePermission(roles: AppRole[]) {
  return roles.includes("organizer") || roles.includes("admin");
}

function hasScanPermission(roles: AppRole[]) {
  return roles.includes("scanner") || roles.includes("organizer") || roles.includes("admin");
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MainHomeShell({
  events,
  feedError,
}: {
  events: BuyerEvent[];
  feedError?: string | null;
}) {
  const supportPhone = "+22656636039";
  const supportWhatsappUrl = `https://wa.me/${supportPhone.replace("+", "")}?text=${encodeURIComponent("Bonjour NeoTicket, j'ai besoin d'aide.")}`;

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, clearAuthUser, setAuthUser } = useAuth();
  const [activeTab, setActiveTab] = useState<HomeTab>("feed");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(user?.displayName ?? "");
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? "");
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [activeTickets, setActiveTickets] = useState<PortfolioTicket[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PortfolioTicket[]>([]);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("tickets");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrModalTicket, setQrModalTicket] = useState<PortfolioTicket | null>(null);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [organizerEvents, setOrganizerEvents] = useState<OrganizerEvent[]>([]);
  const [isLoadingOrgEvents, setIsLoadingOrgEvents] = useState(false);
  const [orgEventsError, setOrgEventsError] = useState<string | null>(null);
  const [payoutModalEvent, setPayoutModalEvent] = useState<OrganizerEvent | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [submittingPayoutId, setSubmittingPayoutId] = useState<string | null>(null);
  const [payoutFeedback, setPayoutFeedback] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [orgRefreshKey, setOrgRefreshKey] = useState(0);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.displayName ?? "");
    setProfilePhone(user.phone);
  }, [user]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "profile") {
      setActiveTab("profile");
      return;
    }

    if (nextTab === "feed") {
      setActiveTab("feed");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || activeTab !== "profile") {
      return;
    }

    const loadPortfolio = async () => {
      setIsLoadingPortfolio(true);
      setPortfolioError(null);

      try {
        const response = await fetch("/api/buyer/portfolio", { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          error?: string;
          portfolio?: {
            activeTickets: PortfolioTicket[];
            purchaseHistory: PortfolioTicket[];
            transactions: PortfolioTransaction[];
          };
        };

        if (!response.ok || !payload.success || !payload.portfolio) {
          setPortfolioError(payload.error ?? "Lecture portefeuille impossible.");
          return;
        }

        setActiveTickets(payload.portfolio.activeTickets);
        setPurchaseHistory(payload.portfolio.purchaseHistory);
        setTransactions(payload.portfolio.transactions);
      } catch {
        setPortfolioError("Erreur reseau pendant le chargement du portefeuille.");
      } finally {
        setIsLoadingPortfolio(false);
      }
    };

    void loadPortfolio();
    const refreshInterval = setInterval(() => {
      void loadPortfolio();
    }, 15000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== "profile" || profileSubTab !== "events") return;
    if (!hasCreatePermission(user.roles)) return;

    const load = async () => {
      setIsLoadingOrgEvents(true);
      setOrgEventsError(null);
      try {
        const response = await fetch("/api/organizer/dashboard", { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          error?: string;
          events?: OrganizerEvent[];
        };
        if (!response.ok || !payload.success) {
          setOrgEventsError(payload.error ?? "Chargement impossible.");
          return;
        }
        setOrganizerEvents(payload.events ?? []);
      } catch {
        setOrgEventsError("Erreur reseau.");
      } finally {
        setIsLoadingOrgEvents(false);
      }
    };
    void load();
  }, [user, activeTab, profileSubTab, orgRefreshKey]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const canCreateEvent = user ? hasCreatePermission(user.roles) : false;
  const canScanEvents = user ? hasScanPermission(user.roles) : false;
  const canManagePayments = user?.phone === "+22656636039";

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clearAuthUser();
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const saveProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileName.trim() || null,
          phone: profilePhone.trim(),
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        user?: {
          id: string;
          phone: string;
          displayName?: string | null;
          roles: string[];
        };
      };

      if (!response.ok || !payload.success || !payload.user) {
        setProfileError(payload.error ?? "Mise a jour impossible.");
        return;
      }

      setAuthUser(payload.user);
      setProfileSuccess("Profil mis a jour avec succes.");
      setEditProfileModal(false);
    } catch {
      setProfileError("Erreur reseau pendant la mise a jour du profil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const requestPayout = async (eventId: string, targetName: string, targetPhone: string) => {
    setSubmittingPayoutId(eventId);
    setPayoutError(null);
    setPayoutFeedback(null);
    try {
      const response = await fetch("/api/organizer/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, receiverName: targetName, receiverPhone: targetPhone }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !payload.success) {
        setPayoutError(payload.error ?? "Demande de reversement impossible.");
        return;
      }
      setPayoutFeedback(payload.message ?? "Votre demande de versement a ete effectuee.");
      setPayoutModalEvent(null);
      setReceiverName("");
      setReceiverPhone("");
      setOrgRefreshKey((v) => v + 1);
    } catch {
      setPayoutError("Erreur reseau pendant la demande de reversement.");
    } finally {
      setSubmittingPayoutId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-black/60">Chargement...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      {/* ── Slim sticky header (visible on feed tab) ── */}
      {activeTab === "feed" ? (
        <header className="sticky top-0 z-30 -mx-4 mb-3 flex items-center justify-between border-b border-black/6 bg-white/95 px-4 py-3 backdrop-blur">
          <span className="flex items-center">
            <NeoTicketLogo size={72} />
          </span>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neo-teal/10 to-neo-green/10 text-neo-teal transition hover:from-neo-teal/20 hover:to-neo-green/20"
            aria-label="Mon profil"
          >
            <IconUser />
          </button>
        </header>
      ) : null}

      {/* ── Feed tab ── */}
      {activeTab === "feed" ? (
        <section>
          {feedError ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Erreur chargement feed: {feedError}
            </div>
          ) : null}
          <EventCatalog events={events} />
        </section>
      ) : null}

      {/* ── Profile tab ── */}
      {activeTab === "profile" ? (
        <section className="pb-2">
          {!user ? (
            <div className="grid gap-4">
              <div className="neo-card rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg font-bold sm:text-xl">Mon Profil</h2>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  Connectez-vous pour acceder a votre profil et a vos actions.
                </p>
              </div>
              <div className="flex justify-center">
                <LoginPhoneForm shouldRedirectOnSuccess={false} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {/* ── Simplified profile header ── */}
              <div className="neo-card rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-black">
                      Bonjour, {user.displayName || "Utilisateur"}
                    </h2>
                    <p className="mt-0.5 text-sm text-black/50">{user.phone}</p>
                  </div>
                  <div className="relative" ref={settingsRef}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className="rounded-xl border border-black/6 p-2.5 text-neo-teal transition-colors hover:bg-neo-teal/5"
                      aria-label="Parametres"
                    >
                      <IconGear />
                    </button>
                    {settingsOpen ? (
                      <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-black/6 bg-white py-1.5 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setEditProfileModal(true);
                            setSettingsOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-black hover:bg-black/5"
                        >
                          Modifier mes infos
                        </button>
                        <a
                          href={supportWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full px-4 py-2.5 text-left text-sm text-neo-teal hover:bg-neo-teal/5"
                        >
                          Besoin d&apos;aide ?
                        </a>
                        {canManagePayments ? (
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/admin/dashboard");
                              setSettingsOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-black hover:bg-black/5"
                          >
                            Administration
                          </button>
                        ) : null}
                        <hr className="my-1 border-black/10" />
                        <button
                          type="button"
                          onClick={() => {
                            void logout();
                            setSettingsOpen(false);
                          }}
                          disabled={isLoggingOut}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {isLoggingOut ? "Deconnexion..." : "Se deconnecter"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── Sub-tabs: Mes Tickets / Mes Evenements ── */}
              <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setProfileSubTab("tickets")}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    profileSubTab === "tickets"
                      ? "neo-gradient text-white shadow-sm"
                      : "text-black/60"
                  }`}
                >
                  Mes Tickets
                </button>
                <button
                  type="button"
                  onClick={() => setProfileSubTab("events")}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    profileSubTab === "events"
                      ? "neo-gradient text-white shadow-sm"
                      : "text-black/60"
                  }`}
                >
                  Mes Evenements
                </button>
              </div>

              {/* ── Mes Tickets content ── */}
              {profileSubTab === "tickets" ? (
                <div className="grid gap-4">
                  {portfolioError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {portfolioError}
                    </p>
                  ) : null}

                  {isLoadingPortfolio ? (
                    <p className="text-sm text-black/60">Chargement...</p>
                  ) : null}

                  {!isLoadingPortfolio ? (
                    <div className="grid gap-4">
                      {/* Active tickets — perforated card design */}
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-black/80">
                          <IconTicket />
                          Tickets Actifs
                        </h3>
                        {activeTickets.length === 0 ? (
                          <p className="text-sm text-black/50">Aucun ticket actif.</p>
                        ) : (
                          <div className="grid gap-3">
                            {activeTickets.map((ticket) => (
                              <div
                                key={ticket.ticketId}
                                className="relative flex overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
                              >
                                {/* Left stub */}
                                <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-dashed border-black/15 bg-black/[0.02]">
                                  <IconTicket />
                                </div>
                                {/* Circular cutouts */}
                                <div className="absolute -top-1.5 left-[52px] h-3 w-3 rounded-full bg-[#f5f5f0]" />
                                <div className="absolute -bottom-1.5 left-[52px] h-3 w-3 rounded-full bg-[#f5f5f0]" />
                                {/* Content */}
                                <div className="flex-1 p-3">
                                  <p className="text-sm font-semibold">{ticket.eventTitle}</p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-black/60">
                                    <span className="inline-flex items-center gap-1">
                                      <IconCalendarSmall />
                                      {formatDate(ticket.eventDate)}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <IconMapPin />
                                      {ticket.eventCity || "-"}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold">
                                      {formatMoney(ticket.price)}
                                    </span>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        ticket.ticketStatus === "scanned"
                                          ? "neo-badge-success"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {ticket.ticketStatus === "scanned" ? "Scanne" : "Valide"}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setQrModalTicket(ticket)}
                                    className="neo-btn mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                                  >
                                    Voir QR Code
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Purchase history — compact list */}
                      {purchaseHistory.length > 0 ? (
                        <div>
                          <h3 className="mb-2 text-sm font-semibold text-black/80">Historique</h3>
                          <div className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
                            {purchaseHistory.map((ticket) => (
                              <div
                                key={ticket.ticketId}
                                className="flex items-center justify-between px-3 py-2.5"
                              >
                                <div>
                                  <p className="text-sm font-medium">{ticket.eventTitle}</p>
                                  <p className="text-xs text-black/50">
                                    {formatDate(ticket.paymentConfirmedAt)}
                                  </p>
                                </div>
                                <p className="text-xs font-semibold text-black/70">
                                  {formatMoney(ticket.price)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Transactions — compact with badges */}
                      {transactions.length > 0 ? (
                        <div>
                          <h3 className="mb-2 text-sm font-semibold text-black/80">Transactions</h3>
                          <div className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
                            {transactions.map((tx) => (
                              <div
                                key={tx.transactionId}
                                className="flex items-center justify-between px-3 py-2.5"
                              >
                                <div>
                                  <p className="text-sm font-medium">{tx.eventTitle}</p>
                                  <p className="text-xs text-black/50">
                                    {formatDate(tx.createdAt)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-semibold">
                                    {formatMoney(tx.amount)}
                                  </p>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      tx.status === "pending"
                                        ? "bg-amber-100 text-amber-800"
                                        : "neo-badge-success"
                                    }`}
                                  >
                                    {tx.status === "pending" ? "En attente" : "Confirme"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── Mes Evenements content ── */}
              {profileSubTab === "events" ? (
                <div className="relative">
                  {!canCreateEvent ? (
                    <div className="neo-card rounded-2xl p-6 text-center">
                      <p className="text-sm text-black/70">
                        Votre compte n&apos;a pas le role organisateur.
                        Contactez un administrateur pour l&apos;activer.
                      </p>
                    </div>
                  ) : (
                    <>
                      {isLoadingOrgEvents ? (
                        <p className="text-sm text-black/60">Chargement...</p>
                      ) : null}
                      {orgEventsError ? (
                        <p className="text-sm text-red-700">{orgEventsError}</p>
                      ) : null}
                      {payoutFeedback ? (
                        <p className="rounded-xl border border-neo-teal/20 bg-gradient-to-r from-neo-teal/5 to-neo-green/5 px-3 py-2 text-sm text-neo-teal-dark">
                          {payoutFeedback}
                        </p>
                      ) : null}
                      {payoutError ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {payoutError}
                        </p>
                      ) : null}

                      {!isLoadingOrgEvents && organizerEvents.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-neo-teal/20 bg-white p-8 text-center">
                          <p className="text-sm text-black/60">Aucun evenement cree.</p>
                          <p className="mt-1 text-xs text-black/40">
                            Utilisez le bouton + pour creer votre premier evenement.
                          </p>
                        </div>
                      ) : null}

                      {!isLoadingOrgEvents && organizerEvents.length > 0 ? (
                        <div className="grid gap-3">
                          {organizerEvents.map((event) => (
                            <article
                              key={event.id}
                              className="neo-card overflow-hidden rounded-xl"
                            >
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold">{event.title}</h4>
                                    <p className="mt-0.5 text-xs text-black/60">
                                      {new Date(event.date).toLocaleDateString("fr-FR", {
                                        dateStyle: "long",
                                      })}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                      event.lifecycleStatus === "en_cours"
                                        ? "neo-badge-success"
                                        : event.lifecycleStatus === "termine"
                                          ? "bg-black/10 text-black/60"
                                          : event.lifecycleStatus === "annule"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {event.lifecycleStatus === "en_cours"
                                      ? "En cours"
                                      : event.lifecycleStatus === "termine"
                                        ? "Termine"
                                        : event.lifecycleStatus === "annule"
                                          ? "Annule"
                                          : "Brouillon"}
                                  </span>
                                </div>

                                {/* Compact fund indicators */}
                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-black/[0.02] p-3 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-black/50">Fonds</span>
                                    <span className="font-semibold">
                                      {formatMoney(event.organizerFunds)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-black/50">Disponible</span>
                                    <span className="font-semibold text-neo-teal">
                                      {formatMoney(event.payoutRequestableAmount)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-black/50">En attente</span>
                                    <span className="font-medium">
                                      {formatMoney(event.payoutPendingAmount)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-black/50">Reverse</span>
                                    <span className="font-medium">
                                      {formatMoney(event.payoutPaidAmount)}
                                    </span>
                                  </div>
                                </div>

                                <p className="mt-2 text-xs text-black/50">
                                  {event.ticketsSold} ticket
                                  {event.ticketsSold !== 1 ? "s" : ""} vendu
                                  {event.ticketsSold !== 1 ? "s" : ""}
                                </p>
                              </div>

                              {/* Actions footer */}
                              <div className="flex items-center gap-2 border-t border-black/5 px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(`/organizer/events/${event.id}/edit`)
                                  }
                                  className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-black hover:border-neo-teal/30 hover:text-neo-teal transition"
                                >
                                  Modifier
                                </button>
                                {event.canRequestPayout ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayoutError(null);
                                      setPayoutFeedback(null);
                                      setPayoutModalEvent(event);
                                      setReceiverName("");
                                      setReceiverPhone("");
                                    }}
                                    disabled={submittingPayoutId === event.id}
                                    className="neo-btn rounded-lg px-3 py-1.5 text-xs"
                                  >
                                    {submittingPayoutId === event.id
                                      ? "Envoi..."
                                      : "Demander versement"}
                                  </button>
                                ) : (
                                  <span
                                    className="text-xs text-black/40"
                                    title={
                                      event.lifecycleStatus !== "termine"
                                        ? "Le versement est disponible uniquement a la fin de l'evenement"
                                        : "Aucun montant disponible ou versement deja en cours"
                                    }
                                  >
                                    {event.lifecycleStatus !== "termine"
                                      ? "Disponible a la fin de l'evenement"
                                      : "Versement en cours de traitement"}
                                  </span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {/* Floating add event button */}
                      <button
                        type="button"
                        onClick={() => router.push("/organizer/new")}
                        className="neo-btn fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
                        aria-label="Ajouter un evenement"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-6 w-6"
                        >
                          <path
                            d="M12 5v14M5 12h14"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* ── Bottom navigation ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/6 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-2 py-2">
          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
              activeTab === "feed" ? "neo-gradient text-white" : "text-black/50 hover:text-neo-teal"
            }`}
          >
            <IconHome />
            Evenements
          </button>

          <button
            type="button"
            onClick={() => {
              router.push("/organizer/new");
            }}
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-black/50 hover:text-neo-teal transition"
          >
            <IconPlus />
            Ajouter
          </button>

          {canScanEvents ? (
            <button
              type="button"
              onClick={() => {
                router.push("/scanner/scan");
              }}
              className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-black/50 hover:text-neo-teal transition"
            >
              <IconScan />
              Scanner
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
              activeTab === "profile" ? "neo-gradient text-white" : "text-black/50 hover:text-neo-teal"
            }`}
          >
            <IconUser />
            Profil
          </button>
        </div>
      </nav>

      {/* ── QR Code modal ── */}
      {qrModalTicket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrModalTicket(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">QR Code</h3>
              <button
                type="button"
                onClick={() => setQrModalTicket(null)}
                className="text-black/40 hover:text-black"
              >
                <IconClose />
              </button>
            </div>
            <p className="mt-1 text-sm text-black/60">{qrModalTicket.eventTitle}</p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${qrModalTicket.ticketId}`}
                alt="QR Code du ticket"
                className="h-64 w-64 rounded-xl border border-black/10"
              />
            </div>
            <p className="mt-3 text-center text-xs text-black/50">
              Presentez ce QR code a l&apos;entree de l&apos;evenement
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Edit profile modal ── */}
      {editProfileModal && user ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditProfileModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Modifier mes infos</h3>
              <button
                type="button"
                onClick={() => {
                  setEditProfileModal(false);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                className="text-black/40 hover:text-black"
              >
                <IconClose />
              </button>
            </div>
            {profileError ? (
              <p className="mt-2 text-sm text-red-700">{profileError}</p>
            ) : null}
            {profileSuccess ? (
              <p className="mt-2 text-sm text-emerald-700">{profileSuccess}</p>
            ) : null}
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Nom</span>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ex: Souleymane"
                  className="rounded-xl border border-black/15 bg-[#fffdf8] px-3 py-2 outline-none"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Numero (E.164)</span>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+22670000000"
                  className="rounded-xl border border-black/15 bg-[#fffdf8] px-3 py-2 outline-none"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={isSavingProfile}
                  className="neo-btn flex-1 rounded-xl px-4 py-2.5 text-sm"
                >
                  {isSavingProfile ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileModal(false);
                    setProfileName(user.displayName ?? "");
                    setProfilePhone(user.phone);
                  }}
                  className="rounded-xl border border-black/20 px-3 py-2.5 text-sm font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Payout request modal ── */}
      {payoutModalEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Demander un versement</h3>
              <button
                type="button"
                onClick={() => {
                  if (!submittingPayoutId) setPayoutModalEvent(null);
                }}
                className="text-black/40 hover:text-black"
              >
                <IconClose />
              </button>
            </div>
            <p className="mt-2 text-sm text-black/70">
              Evenement:{" "}
              <span className="font-medium">{payoutModalEvent.title}</span>
            </p>
            <p className="mt-1 text-sm text-black/70">
              Montant a verser:{" "}
              <span className="font-semibold">
                {formatMoney(payoutModalEvent.payoutRequestableAmount)}
              </span>
            </p>

            <label className="mt-4 grid gap-1 text-sm">
              <span className="font-medium">Nom du receveur</span>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Ex: Souleymane Ouedraogo"
                className="rounded-xl border border-black/15 bg-[#fffdf8] px-3 py-2 outline-none"
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
                onClick={() => {
                  if (!submittingPayoutId) setPayoutModalEvent(null);
                }}
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
                disabled={submittingPayoutId === payoutModalEvent.id}
                className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {submittingPayoutId === payoutModalEvent.id
                  ? "Envoi..."
                  : "Confirmer la demande"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
