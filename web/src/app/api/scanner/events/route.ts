import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  organizer_id: string;
  status: "draft" | "published" | "ended" | "cancelled";
};

export async function GET() {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
  }

  const roles = normalizeRoles(session.roles);
  const canScan = roles.includes("scanner") || roles.includes("organizer") || roles.includes("admin");

  if (!canScan) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();

  if (roles.includes("admin")) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date, end_date, organizer_id, status")
      .order("date", { ascending: false })
      .returns<EventRow[]>();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Lecture des evenements impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, events: data ?? [] });
  }

  if (roles.includes("organizer")) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date, end_date, organizer_id, status")
      .eq("organizer_id", session.userId)
      .order("date", { ascending: false })
      .returns<EventRow[]>();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Lecture des evenements impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, events: data ?? [] });
  }

  const { data, error } = await supabase
    .from("event_scanners")
    .select("events!inner(id, title, date, end_date, organizer_id, status)")
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Lecture des evenements scanner impossible." },
      { status: 500 },
    );
  }

  const events = (data ?? [])
    .map((row: { events: EventRow | EventRow[] | null }) =>
      Array.isArray(row.events) ? row.events[0] : row.events,
    )
    .filter((row): row is EventRow => Boolean(row));

  return NextResponse.json({ success: true, events });
}
