import { NextResponse } from "next/server";

import { normalizeRoles } from "@/lib/auth/roles";
import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  status: "draft" | "published" | "ended" | "cancelled";
  users: { phone: string } | { phone: string }[] | null;
};

type TicketRow = {
  id: string;
  event_id: string;
  status: "pending" | "paid" | "scanned" | "cancelled";
};

type TransactionRow = {
  event_id: string;
  ticket_id: string;
  organizer_amount: number;
};

type PayoutRow = {
  id: string;
  event_id: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  requested_at: string;
  paid_at: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  events: { title: string } | { title: string }[] | null;
};

function getEffectiveEndAt(event: { date: string; end_date: string | null }) {
  const startAt = new Date(event.date);
  if (event.end_date) {
    return new Date(event.end_date);
  }

  return new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
}

export async function GET() {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();

  const { data: eventsData, error: eventsError } = await supabase
    .from("events")
    .select("id, title, date, end_date, status, users!events_organizer_id_fkey(phone)")
    .in("status", ["published", "ended", "cancelled"])
    .returns<EventRow[]>();

  if (eventsError) {
    return NextResponse.json(
      { success: false, error: "Lecture des evenements impossible." },
      { status: 500 },
    );
  }

  const scopedEvents = (eventsData ?? [])
    .map((event) => {
      const effectiveEndAt = getEffectiveEndAt(event);
      const organizerRecord = Array.isArray(event.users) ? event.users[0] : event.users;

      return {
        id: event.id,
        title: event.title,
        status: event.status,
        date: event.date,
        endDate: event.end_date,
        effectiveEndAt: effectiveEndAt.toISOString(),
        organizerPhone: organizerRecord?.phone ?? null,
      };
    })
    .sort((a, b) => new Date(b.effectiveEndAt).getTime() - new Date(a.effectiveEndAt).getTime());

  if (scopedEvents.length === 0) {
    return NextResponse.json({
      success: true,
      events: [],
      payouts: [],
      summary: {
        totalEscrowAmount: 0,
        pendingPayoutAmount: 0,
        paidPayoutAmount: 0,
        gainAmount: 0,
      },
    });
  }

  const allEventIds = (eventsData ?? []).map((event) => event.id);

  const { data: transactionsData, error: transactionsError } = await supabase
    .from("transactions")
    .select("event_id, ticket_id, organizer_amount")
    .in("event_id", allEventIds)
    .eq("status", "success")
    .returns<TransactionRow[]>();

  if (transactionsError) {
    return NextResponse.json(
      { success: false, error: "Lecture des transactions impossible." },
      { status: 500 },
    );
  }

  const ticketIds = Array.from(new Set((transactionsData ?? []).map((row) => row.ticket_id)));

  let ticketStatusById = new Map<string, TicketRow["status"]>();

  if (ticketIds.length > 0) {
    const { data: ticketsData, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, event_id, status")
      .in("id", ticketIds)
      .returns<TicketRow[]>();

    if (ticketsError) {
      return NextResponse.json(
        { success: false, error: "Lecture des tickets impossible." },
        { status: 500 },
      );
    }

    ticketStatusById = new Map((ticketsData ?? []).map((ticket) => [ticket.id, ticket.status]));
  }

  const escrowByEvent = new Map<string, number>();

  for (const transaction of transactionsData ?? []) {
    const ticketStatus = ticketStatusById.get(transaction.ticket_id);
    if (ticketStatus !== "paid" && ticketStatus !== "scanned") {
      continue;
    }

    escrowByEvent.set(
      transaction.event_id,
      (escrowByEvent.get(transaction.event_id) ?? 0) + Number(transaction.organizer_amount),
    );
  }

  const { data: payoutsData, error: payoutsError } = await supabase
    .from("payouts")
    .select("id, event_id, amount, status, requested_at, paid_at, receiver_name, receiver_phone, events(title)")
    .in("event_id", allEventIds)
    .order("requested_at", { ascending: false })
    .returns<PayoutRow[]>();

  if (payoutsError) {
    return NextResponse.json(
      { success: false, error: "Lecture des reversements impossible." },
      { status: 500 },
    );
  }

  const payoutsByEvent = new Map<string, { pending: number; paid: number }>();
  for (const payout of payoutsData ?? []) {
    const current = payoutsByEvent.get(payout.event_id) ?? { pending: 0, paid: 0 };
    if (payout.status === "pending") {
      current.pending += Number(payout.amount);
    }

    if (payout.status === "paid") {
      current.paid += Number(payout.amount);
    }

    payoutsByEvent.set(payout.event_id, current);
  }

  const events = scopedEvents.map((event) => {
    const escrowAmount = escrowByEvent.get(event.id) ?? 0;
    const payouts = payoutsByEvent.get(event.id) ?? { pending: 0, paid: 0 };

    return {
      ...event,
      escrowAmount,
      pendingPayoutAmount: payouts.pending,
      paidPayoutAmount: payouts.paid,
      netToPay: Math.max(0, escrowAmount - payouts.paid),
    };
  });

  const payouts = (payoutsData ?? []).map((payout) => ({
    id: payout.id,
    eventId: payout.event_id,
    eventTitle: Array.isArray(payout.events) ? payout.events[0]?.title : payout.events?.title,
    amount: Number(payout.amount),
    status: payout.status,
    requestedAt: payout.requested_at,
    paidAt: payout.paid_at,
    receiverName: payout.receiver_name,
    receiverPhone: payout.receiver_phone,
  }));

  const totalEscrowAmount = events.reduce((sum, event) => sum + event.escrowAmount, 0);
  const pendingPayoutAmount = events.reduce((sum, event) => sum + event.pendingPayoutAmount, 0);
  const paidPayoutAmount = events.reduce((sum, event) => sum + event.paidPayoutAmount, 0);
  const gainAmount = Math.max(0, totalEscrowAmount - pendingPayoutAmount - paidPayoutAmount);

  return NextResponse.json({
    success: true,
    events,
    payouts,
    summary: {
      totalEscrowAmount,
      pendingPayoutAmount,
      paidPayoutAmount,
      gainAmount,
    },
  });
}
