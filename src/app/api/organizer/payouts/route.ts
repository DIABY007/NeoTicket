import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { normalizeRoles } from "@/lib/auth/roles";
import { isE164Phone, normalizePhone } from "@/lib/auth/phone";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  organizer_id: string;
  date: string;
  end_date: string | null;
};

type TxRow = {
  ticket_id: string;
  organizer_amount: number;
};

type TicketRow = {
  id: string;
  status: "pending" | "paid" | "scanned" | "cancelled";
};

type PayoutRow = {
  amount: number;
  status: "pending" | "paid" | "rejected";
};

export async function POST(request: Request) {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Configuration serveur manquante." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
  }

  const session = parseAppSessionToken(sessionToken, secret);
  if (!session) {
    cookieStore.delete(APP_SESSION_COOKIE);
    return NextResponse.json({ success: false, error: "Session invalide." }, { status: 401 });
  }

  const roles = normalizeRoles(session.roles);
  if (!roles.includes("organizer") && !roles.includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    receiverName?: string;
    receiverPhone?: string;
  };
  const eventId = String(body.eventId ?? "").trim();
  const receiverName = String(body.receiverName ?? "").trim();
  const receiverPhoneRaw = String(body.receiverPhone ?? "").trim();
  const receiverPhone = normalizePhone(receiverPhoneRaw);

  if (!eventId) {
    return NextResponse.json({ success: false, error: "eventId est requis." }, { status: 400 });
  }

  if (!receiverName) {
    return NextResponse.json({ success: false, error: "Le nom du receveur est requis." }, { status: 400 });
  }

  if (!isE164Phone(receiverPhone)) {
    return NextResponse.json(
      { success: false, error: "Le numero du receveur doit etre au format E.164." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, organizer_id, date, end_date")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Evenement introuvable." }, { status: 404 });
  }

  if (!roles.includes("admin") && event.organizer_id !== session.userId) {
    return NextResponse.json(
      { success: false, error: "Acces non autorise a cet evenement." },
      { status: 403 },
    );
  }

  const { data: txRows, error: txError } = await supabase
    .from("transactions")
    .select("ticket_id, organizer_amount")
    .eq("event_id", eventId)
    .eq("status", "success")
    .returns<TxRow[]>();

  if (txError) {
    return NextResponse.json(
      { success: false, error: "Lecture des transactions impossible." },
      { status: 500 },
    );
  }

  const ticketIds = Array.from(new Set((txRows ?? []).map((row) => row.ticket_id)));

  let paidOrScanned = new Set<string>();
  if (ticketIds.length > 0) {
    const { data: ticketsData, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, status")
      .in("id", ticketIds)
      .returns<TicketRow[]>();

    if (ticketsError) {
      return NextResponse.json(
        { success: false, error: "Lecture des tickets impossible." },
        { status: 500 },
      );
    }

    paidOrScanned = new Set(
      (ticketsData ?? [])
        .filter((ticket) => ticket.status === "paid" || ticket.status === "scanned")
        .map((ticket) => ticket.id),
    );
  }

  const escrow = (txRows ?? [])
    .filter((tx) => paidOrScanned.has(tx.ticket_id))
    .reduce((sum, tx) => sum + Number(tx.organizer_amount), 0);

  const { data: payoutRows, error: payoutError } = await supabase
    .from("payouts")
    .select("amount, status")
    .eq("event_id", eventId)
    .returns<PayoutRow[]>();

  if (payoutError) {
    return NextResponse.json(
      { success: false, error: "Lecture des reversements impossible." },
      { status: 500 },
    );
  }

  const pendingAmount = (payoutRows ?? [])
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const paidAmount = (payoutRows ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const requestable = Math.max(0, Math.round(escrow - pendingAmount - paidAmount));

  if (requestable <= 0) {
    return NextResponse.json(
      { success: false, error: "Aucun montant disponible pour un nouveau reversement." },
      { status: 400 },
    );
  }

  const { data: payout, error: createError } = await supabase
    .from("payouts")
    .insert({
      event_id: eventId,
      amount: requestable,
      status: "pending",
      requested_by: session.userId,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
    })
    .select("id, event_id, amount, status, requested_at")
    .single<{
      id: string;
      event_id: string;
      amount: number;
      status: "pending" | "paid" | "rejected";
      requested_at: string;
    }>();

  if (createError || !payout) {
    return NextResponse.json(
      { success: false, error: "Creation de la demande de reversement impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Votre demande de versement a ete effectuee.",
    payout: {
      id: payout.id,
      eventId: payout.event_id,
      amount: Number(payout.amount),
      status: payout.status,
      requestedAt: payout.requested_at,
    },
  });
}
