import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { normalizeRoles } from "@/lib/auth/roles";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
};

type TicketRow = {
  id: string;
  event_id: string;
};

type TransactionRow = {
  ticket_id: string;
  event_id: string;
  organizer_amount: number;
};

type PayoutRow = {
  event_id: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
};

function getEventEndAt(event: EventRow) {
  const startAt = new Date(event.date);
  if (event.end_date) {
    return new Date(event.end_date);
  }

  return new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
}

function computeLifecycleStatus(event: EventRow): "brouillon" | "annule" | "en_cours" | "termine" {
  if (event.status === "draft") {
    return "brouillon";
  }

  if (event.status === "cancelled") {
    return "annule";
  }

  const endAt = getEventEndAt(event);

  return Date.now() >= endAt.getTime() || event.status === "ended" ? "termine" : "en_cours";
}

export async function GET() {
  try {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Configuration serveur manquante." },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Session absente." },
        { status: 401 },
      );
    }

    const session = parseAppSessionToken(sessionToken, secret);
    if (!session) {
      cookieStore.delete(APP_SESSION_COOKIE);
      return NextResponse.json(
        { success: false, error: "Session invalide." },
        { status: 401 },
      );
    }

    const roles = normalizeRoles(session.roles);
    if (!roles.includes("organizer") && !roles.includes("admin")) {
      return NextResponse.json(
        { success: false, error: "Acces refuse." },
        { status: 403 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, date, end_date, status")
      .eq("organizer_id", session.userId)
      .order("date", { ascending: false })
      .returns<EventRow[]>();

    if (eventsError) {
      return NextResponse.json(
        { success: false, error: "Lecture des evenements impossible." },
        { status: 500 },
      );
    }

    const safeEvents = events ?? [];
    if (safeEvents.length === 0) {
      return NextResponse.json({ success: true, events: [] });
    }

    const eventIds = safeEvents.map((event) => event.id);

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, event_id")
      .in("event_id", eventIds)
      .in("status", ["paid", "scanned"])
      .returns<TicketRow[]>();

    if (ticketsError) {
      return NextResponse.json(
        { success: false, error: "Lecture tickets impossible." },
        { status: 500 },
      );
    }

    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("event_id, ticket_id, organizer_amount")
      .in("event_id", eventIds)
      .eq("status", "success")
      .returns<TransactionRow[]>();

    if (transactionsError) {
      return NextResponse.json(
        { success: false, error: "Lecture transactions impossible." },
        { status: 500 },
      );
    }

    const soldCountByEvent = new Map<string, number>();
    for (const ticket of tickets ?? []) {
      soldCountByEvent.set(ticket.event_id, (soldCountByEvent.get(ticket.event_id) ?? 0) + 1);
    }

    const paidOrScannedTicketIds = new Set((tickets ?? []).map((ticket) => ticket.id));

    const fundsByEvent = new Map<string, number>();
    for (const transaction of transactions ?? []) {
      if (!paidOrScannedTicketIds.has(transaction.ticket_id)) {
        continue;
      }

      fundsByEvent.set(
        transaction.event_id,
        (fundsByEvent.get(transaction.event_id) ?? 0) + Number(transaction.organizer_amount),
      );
    }

    const { data: payouts, error: payoutsError } = await supabase
      .from("payouts")
      .select("event_id, amount, status")
      .in("event_id", eventIds)
      .returns<PayoutRow[]>();

    if (payoutsError) {
      return NextResponse.json(
        { success: false, error: "Lecture des reversements impossible." },
        { status: 500 },
      );
    }

    const payoutPendingByEvent = new Map<string, number>();
    const payoutPaidByEvent = new Map<string, number>();

    for (const payout of payouts ?? []) {
      if (payout.status === "pending") {
        payoutPendingByEvent.set(
          payout.event_id,
          (payoutPendingByEvent.get(payout.event_id) ?? 0) + Number(payout.amount),
        );
      }

      if (payout.status === "paid") {
        payoutPaidByEvent.set(
          payout.event_id,
          (payoutPaidByEvent.get(payout.event_id) ?? 0) + Number(payout.amount),
        );
      }
    }

    const results = safeEvents.map((event) => {
      const payoutRequestableAmount = Math.max(
        0,
        (fundsByEvent.get(event.id) ?? 0) - (payoutPendingByEvent.get(event.id) ?? 0) - (payoutPaidByEvent.get(event.id) ?? 0),
      );
      const isPayoutWindowOpen = Date.now() >= getEventEndAt(event).getTime() || event.status === "ended";

      return {
        organizerFunds: fundsByEvent.get(event.id) ?? 0,
        payoutPendingAmount: payoutPendingByEvent.get(event.id) ?? 0,
        payoutPaidAmount: payoutPaidByEvent.get(event.id) ?? 0,
        payoutRequestableAmount,
        id: event.id,
        title: event.title,
        date: event.date,
        endDate: event.end_date,
        sourceStatus: event.status,
        lifecycleStatus: computeLifecycleStatus(event),
        ticketsSold: soldCountByEvent.get(event.id) ?? 0,
        canRequestPayout: isPayoutWindowOpen && payoutRequestableAmount > 0,
      };
    });

    return NextResponse.json({ success: true, events: results });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur inattendue du dashboard organisateur." },
      { status: 500 },
    );
  }
}
