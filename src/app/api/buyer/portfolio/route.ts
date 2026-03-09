import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TicketStatus = "pending" | "paid" | "scanned" | "cancelled";
type TxStatus = "pending" | "success" | "failed";

type TicketRow = {
  id: string;
  event_id: string;
  buyer_phone: string;
  status: TicketStatus;
  payment_confirmed_at: string | null;
  scanned_at: string | null;
  created_at: string;
  events:
    | {
        title: string;
        date: string;
        city: string | null;
        price: number;
      }
    | {
        title: string;
        date: string;
        city: string | null;
        price: number;
      }[]
    | null;
};

type TxRow = {
  id: string;
  ticket_id: string;
  event_id: string;
  status: TxStatus;
  total_amount: number;
  created_at: string;
  paid_at: string | null;
  events:
    | {
        title: string;
        date: string;
      }
    | {
        title: string;
        date: string;
      }[]
    | null;
};

function pickEvent<T>(eventField: T | T[] | null): T | null {
  if (!eventField) {
    return null;
  }

  if (Array.isArray(eventField)) {
    return eventField[0] ?? null;
  }

  return eventField;
}

export async function GET() {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifie." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();

  const [ticketsByUserRes, ticketsByPhoneRes, txByPhoneRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, event_id, buyer_phone, status, payment_confirmed_at, scanned_at, created_at, events(title, date, city, price)")
      .eq("buyer_id", session.userId)
      .returns<TicketRow[]>(),
    supabase
      .from("tickets")
      .select("id, event_id, buyer_phone, status, payment_confirmed_at, scanned_at, created_at, events(title, date, city, price)")
      .eq("buyer_phone", session.phone)
      .returns<TicketRow[]>(),
    supabase
      .from("transactions")
      .select("id, ticket_id, event_id, status, total_amount, created_at, paid_at, events(title, date)")
      .eq("buyer_phone", session.phone)
      .in("status", ["pending", "success"])
      .order("created_at", { ascending: false })
      .returns<TxRow[]>(),
  ]);

  if (ticketsByUserRes.error || ticketsByPhoneRes.error || txByPhoneRes.error) {
    return NextResponse.json(
      { success: false, error: "Lecture portefeuille impossible." },
      { status: 500 },
    );
  }

  const ticketMap = new Map<string, TicketRow>();
  for (const row of ticketsByUserRes.data ?? []) {
    ticketMap.set(row.id, row);
  }
  for (const row of ticketsByPhoneRes.data ?? []) {
    ticketMap.set(row.id, row);
  }

  const now = Date.now();

  const allTickets = Array.from(ticketMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const confirmedTickets = allTickets.filter(
    (ticket) => ticket.status === "paid" || ticket.status === "scanned",
  );

  const activeTickets = confirmedTickets
    .filter((ticket) => {
      const eventInfo = pickEvent(ticket.events);
      if (!eventInfo?.date) return false;
      return new Date(eventInfo.date).getTime() >= now;
    })
    .map((ticket) => {
      const eventInfo = pickEvent(ticket.events);
      return {
        ticketId: ticket.id,
        eventId: ticket.event_id,
        eventTitle: eventInfo?.title ?? "Evenement",
        eventDate: eventInfo?.date ?? null,
        eventCity: eventInfo?.city ?? null,
        price: Number(eventInfo?.price ?? 0),
        ticketStatus: ticket.status,
        scannedAt: ticket.scanned_at,
        paymentConfirmedAt: ticket.payment_confirmed_at,
      };
    });

  const purchaseHistory = confirmedTickets
    .map((ticket) => {
      const eventInfo = pickEvent(ticket.events);
      return {
        ticketId: ticket.id,
        eventId: ticket.event_id,
        eventTitle: eventInfo?.title ?? "Evenement",
        eventDate: eventInfo?.date ?? null,
        eventCity: eventInfo?.city ?? null,
        price: Number(eventInfo?.price ?? 0),
        ticketStatus: ticket.status,
        scannedAt: ticket.scanned_at,
        paymentConfirmedAt: ticket.payment_confirmed_at,
      };
    });

  const transactions = (txByPhoneRes.data ?? []).map((tx) => {
    const eventInfo = pickEvent(tx.events);
    return {
      transactionId: tx.id,
      ticketId: tx.ticket_id,
      eventId: tx.event_id,
      eventTitle: eventInfo?.title ?? "Evenement",
      eventDate: eventInfo?.date ?? null,
      amount: Number(tx.total_amount),
      status: tx.status,
      createdAt: tx.created_at,
      paidAt: tx.paid_at,
    };
  });

  return NextResponse.json({
    success: true,
    portfolio: {
      activeTickets,
      purchaseHistory,
      transactions,
    },
  });
}
