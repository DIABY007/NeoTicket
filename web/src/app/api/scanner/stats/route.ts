import { NextRequest, NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
  }

  const roles = normalizeRoles(session.roles);
  const canScan = roles.includes("scanner") || roles.includes("organizer") || roles.includes("admin");

  if (!canScan) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ success: false, error: "eventId requis." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { count: totalCount, error: totalError } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["paid", "scanned"]);

  if (totalError) {
    return NextResponse.json(
      { success: false, error: "Lecture des tickets impossible." },
      { status: 500 },
    );
  }

  const { count: scannedCount, error: scannedError } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "scanned");

  if (scannedError) {
    return NextResponse.json(
      { success: false, error: "Lecture des tickets scannes impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    scanned: scannedCount ?? 0,
    total: totalCount ?? 0,
  });
}
