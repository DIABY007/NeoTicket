import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  organizer_id: string;
};

type TicketRow = {
  id: string;
  event_id: string;
  buyer_id: string | null;
  buyer_phone: string;
  status: "pending" | "paid" | "scanned" | "cancelled";
};

type UserRow = {
  display_name: string | null;
};

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
  }

  const roles = normalizeRoles(session.roles);
  const canScan = roles.includes("scanner") || roles.includes("organizer") || roles.includes("admin");

  if (!canScan) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as { eventId?: string; qrCodeHash?: string };
  const eventId = String(body.eventId ?? "").trim();
  const qrCodeHash = String(body.qrCodeHash ?? "").trim();

  if (!eventId || !qrCodeHash) {
    return NextResponse.json(
      { success: false, error: "eventId et qrCodeHash sont requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Evenement introuvable." }, { status: 404 });
  }

  if (!roles.includes("admin")) {
    if (roles.includes("organizer")) {
      if (event.organizer_id !== session.userId) {
        return NextResponse.json(
          { success: false, error: "Acces non autorise a cet evenement." },
          { status: 403 },
        );
      }
    } else {
      const { data: assignment } = await supabase
        .from("event_scanners")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", session.userId)
        .maybeSingle<{ id: string }>();

      if (!assignment) {
        return NextResponse.json(
          { success: false, error: "Ce scanner n'est pas assigne a cet evenement." },
          { status: 403 },
        );
      }
    }
  }

  const { data: ticketWithEvent, error: sameEventError } = await supabase
    .from("tickets")
    .select("id, event_id, buyer_id, buyer_phone, status")
    .eq("event_id", eventId)
    .eq("qr_code_hash", qrCodeHash)
    .maybeSingle<TicketRow>();

  if (sameEventError) {
    return NextResponse.json(
      { success: false, error: "Lecture ticket impossible." },
      { status: 500 },
    );
  }

  if (!ticketWithEvent) {
    const { data: ticketAnyEvent, error: anyEventError } = await supabase
      .from("tickets")
      .select("id, event_id, buyer_id, buyer_phone, status")
      .eq("qr_code_hash", qrCodeHash)
      .maybeSingle<TicketRow>();

    if (anyEventError) {
      return NextResponse.json(
        { success: false, error: "Lecture ticket impossible." },
        { status: 500 },
      );
    }

    if (ticketAnyEvent) {
      return NextResponse.json(
        {
          success: false,
          code: "wrong_event",
          error: "Ce code n'est pas lie a cet evenement.",
          ticketStatus: ticketAnyEvent.status,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, code: "not_found", error: "Ticket introuvable." },
      { status: 404 },
    );
  }

  if (ticketWithEvent.status === "scanned") {
    return NextResponse.json(
      {
        success: false,
        code: "already_scanned",
        error: "Ce code a deja ete valide.",
        ticketStatus: ticketWithEvent.status,
      },
      { status: 400 },
    );
  }

  if (ticketWithEvent.status !== "paid") {
    return NextResponse.json(
      {
        success: false,
        code: "not_paid",
        error: "Ticket non paye ou non valide.",
        ticketStatus: ticketWithEvent.status,
      },
      { status: 400 },
    );
  }

  const scannedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      status: "scanned",
      scanned_at: scannedAt,
    })
    .eq("id", ticketWithEvent.id)
    .eq("status", "paid");

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Validation scan impossible." },
      { status: 500 },
    );
  }

  let buyerName: string | null = null;
  if (ticketWithEvent.buyer_id) {
    const { data: buyerRow } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", ticketWithEvent.buyer_id)
      .maybeSingle<UserRow>();
    buyerName = buyerRow?.display_name ?? null;
  }

  return NextResponse.json({
    success: true,
    code: "validated",
    message: "Ticket valide.",
    ticketId: ticketWithEvent.id,
    buyerName: buyerName || ticketWithEvent.buyer_phone,
    scannedAt,
  });
}
