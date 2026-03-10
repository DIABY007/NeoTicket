import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendWhatsAppTextMessage } from "@/lib/wasender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderType = "D3" | "D1" | "H3";

type TicketReminderCandidate = {
  id: string;
  buyer_phone: string;
  event_id: string;
  events:
    | {
        id: string;
        title: string;
        date: string;
        city: string | null;
        slug: string;
        status: "draft" | "published" | "ended" | "cancelled";
      }
    | {
        id: string;
        title: string;
        date: string;
        city: string | null;
        slug: string;
        status: "draft" | "published" | "ended" | "cancelled";
      }[]
    | null;
};

function resolvePublicBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_PUBLIC_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) {
      return value.replace(/\/$/, "");
    }
  }

  return "https://neoticket.live";
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return { ok: false as const, status: 500, error: "CRON_SECRET manquant." };
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization) {
    return { ok: false as const, status: 401, error: "Authorization manquant." };
  }

  if (authorization === secret || authorization === `Bearer ${secret}`) {
    return { ok: true as const };
  }

  return { ok: false as const, status: 401, error: "Authorization invalide." };
}

function findDueReminderTypes(now: Date, eventDateISO: string): ReminderType[] {
  const eventDate = new Date(eventDateISO);
  if (Number.isNaN(eventDate.getTime())) {
    return [];
  }

  const windows: Array<{ type: ReminderType; hoursBefore: number }> = [
    { type: "D3", hoursBefore: 72 },
    { type: "D1", hoursBefore: 24 },
    { type: "H3", hoursBefore: 3 },
  ];

  const toleranceMs = 20 * 60 * 1000; // cron every 15 min + execution drift

  return windows
    .filter((window) => {
      const targetTs = eventDate.getTime() - window.hoursBefore * 60 * 60 * 1000;
      return Math.abs(now.getTime() - targetTs) <= toleranceMs;
    })
    .map((window) => window.type);
}

function formatReminderLabel(type: ReminderType) {
  if (type === "D3") return "dans 3 jours";
  if (type === "D1") return "demain";
  return "dans 3 heures";
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Ouagadougou",
  });
}

export async function POST(request: Request) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = getSupabaseServerClient();
  const now = new Date();
  const lookAhead = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const baseUrl = resolvePublicBaseUrl();

  const { data: candidates, error: candidatesError } = await supabase
    .from("tickets")
    .select("id, buyer_phone, event_id, events!tickets_event_id_fkey(id, title, date, city, slug, status)")
    .in("status", ["paid", "scanned"])
    .eq("events.status", "published")
    .gte("events.date", now.toISOString())
    .lte("events.date", lookAhead.toISOString())
    .limit(500)
    .returns<TicketReminderCandidate[]>();

  if (candidatesError) {
    return NextResponse.json(
      {
        success: false,
        error: "Lecture des rappels impossible.",
        details: candidatesError.message,
      },
      { status: 500 },
    );
  }

  const dueItems: Array<{
    ticketId: string;
    eventId: string;
    buyerPhone: string;
    reminderType: ReminderType;
    title: string;
    city: string | null;
    date: string;
    slug: string;
  }> = [];

  for (const row of candidates ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event) continue;

    const dueTypes = findDueReminderTypes(now, event.date);
    for (const reminderType of dueTypes) {
      dueItems.push({
        ticketId: row.id,
        eventId: row.event_id,
        buyerPhone: row.buyer_phone,
        reminderType,
        title: event.title,
        city: event.city,
        date: event.date,
        slug: event.slug,
      });
    }
  }

  if (dueItems.length === 0) {
    return NextResponse.json({
      success: true,
      checked: (candidates ?? []).length,
      due: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    });
  }

  const ticketIds = [...new Set(dueItems.map((item) => item.ticketId))];
  const reminderTypes = [...new Set(dueItems.map((item) => item.reminderType))];

  const { data: alreadySentRows } = await supabase
    .from("whatsapp_reminders")
    .select("ticket_id, reminder_type")
    .in("ticket_id", ticketIds)
    .in("reminder_type", reminderTypes)
    .returns<Array<{ ticket_id: string; reminder_type: ReminderType }>>();

  const sentSet = new Set(
    (alreadySentRows ?? []).map((row) => `${row.ticket_id}:${row.reminder_type}`),
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of dueItems) {
    const dedupeKey = `${item.ticketId}:${item.reminderType}`;
    if (sentSet.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    const whenLabel = formatReminderLabel(item.reminderType);
    const eventDateLabel = formatEventDate(item.date);
    const cityLine = item.city ? `Ville: ${item.city}` : "";
    const eventUrl = `${baseUrl}/e/${item.slug}`;

    const text = [
      `Rappel NeoTicket: votre evenement \"${item.title}\" commence ${whenLabel}.`,
      `Date: ${eventDateLabel}`,
      cityLine,
      `Details: ${eventUrl}`,
      "Presentez votre QR code a l'entree.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendWhatsAppTextMessage({ to: item.buyerPhone, text });

      const { error: insertError } = await supabase.from("whatsapp_reminders").insert({
        ticket_id: item.ticketId,
        event_id: item.eventId,
        reminder_type: item.reminderType,
      });

      if (insertError) {
        // If another run inserted the same reminder first, treat as skipped.
        if (insertError.message.toLowerCase().includes("duplicate")) {
          skipped += 1;
          sentSet.add(dedupeKey);
          continue;
        }

        errors += 1;
        continue;
      }

      sent += 1;
      sentSet.add(dedupeKey);
    } catch {
      errors += 1;
    }
  }

  return NextResponse.json({
    success: true,
    checked: (candidates ?? []).length,
    due: dueItems.length,
    sent,
    skipped,
    errors,
  });
}
