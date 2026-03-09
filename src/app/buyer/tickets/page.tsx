import Link from "next/link";

import { LoginPhoneForm } from "@/components/auth/login-phone-form";
import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TicketRow = {
  id: string;
  status: "pending" | "paid" | "scanned" | "cancelled";
  created_at: string;
  payment_confirmed_at: string | null;
  scanned_at: string | null;
  events:
    | {
        title: string;
        price: number;
        date: string;
        city: string | null;
      }
    | {
        title: string;
        price: number;
        date: string;
        city: string | null;
      }[]
    | null;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getEventInfo(eventField: TicketRow["events"]) {
  if (!eventField) {
    return null;
  }

  if (Array.isArray(eventField)) {
    return eventField[0] ?? null;
  }

  return eventField;
}

export default async function BuyerTicketsPage() {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Mes tickets</h1>
          <p className="mt-2 text-sm text-black/70">
            Connectez-vous pour voir vos tickets payes.
          </p>
          <div className="mt-5">
            <LoginPhoneForm shouldRedirectOnSuccess={false} />
          </div>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-black/70 underline underline-offset-4">
            Retour au feed
          </Link>
        </section>
      </main>
    );
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("tickets")
    .select("id, status, created_at, payment_confirmed_at, scanned_at, events(title, price, date, city)")
    .eq("buyer_id", session.userId)
    .in("status", ["paid", "scanned"])
    .order("created_at", { ascending: false })
    .returns<TicketRow[]>();

  const tickets = error ? [] : (data ?? []);

  return (
    <main className="min-h-screen px-4 py-6">
      <section className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Mes tickets</h1>
            <p className="mt-1 text-sm text-black/70">Tous vos tickets payes et leur statut de scan.</p>
          </div>
          <Link href="/" className="rounded-xl border border-black/20 px-3 py-2 text-sm font-medium text-black">
            Retour au feed
          </Link>
        </div>

        {error ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Erreur lecture tickets: {error.message}
          </p>
        ) : null}

        {!error && tickets.length === 0 ? (
          <p className="mt-5 rounded-xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-black/70">
            Aucun ticket paye pour le moment.
          </p>
        ) : null}

        {tickets.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {tickets.map((ticket) => {
              const eventInfo = getEventInfo(ticket.events);
              const isScanned = ticket.status === "scanned";

              return (
                <article key={ticket.id} className="rounded-xl border border-black/10 bg-[#fcfbf8] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">
                        {eventInfo?.title ?? "Evenement non disponible"}
                      </h2>
                      <p className="mt-1 text-sm text-black/70">
                        Prix: {eventInfo ? formatMoney(Number(eventInfo.price)) : "-"}
                      </p>
                      <p className="text-sm text-black/70">
                        Date evenement: {eventInfo?.date ? formatDate(eventInfo.date) : "-"}
                      </p>
                      <p className="text-sm text-black/70">Ville: {eventInfo?.city ?? "-"}</p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        isScanned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isScanned ? "Scanne" : "Pas encore scanne"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-black/60">
                    <p>Ticket ID: {ticket.id}</p>
                    <p>Paiement confirme le: {ticket.payment_confirmed_at ? formatDate(ticket.payment_confirmed_at) : "-"}</p>
                    <p>Scanne le: {ticket.scanned_at ? formatDate(ticket.scanned_at) : "Pas encore"}</p>
                    <p>Cree le: {formatDate(ticket.created_at)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
