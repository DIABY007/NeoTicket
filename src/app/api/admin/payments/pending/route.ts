import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, event_id, buyer_phone, total_amount, created_at, provider_payload, events(title)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Lecture transactions pending impossible." },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map(
    (row: {
      id: string;
      event_id: string;
      buyer_phone: string;
      total_amount: number;
      created_at: string;
      provider_payload: { buyerName?: string } | null;
      events: { title: string } | { title: string }[] | null;
    }) => ({
      id: row.id,
      eventId: row.event_id,
      buyerName: row.provider_payload?.buyerName,
      buyerPhone: row.buyer_phone,
      amount: Number(row.total_amount),
      createdAt: row.created_at,
      eventTitle: Array.isArray(row.events) ? row.events[0]?.title : row.events?.title,
    }),
  );

  return NextResponse.json({ success: true, transactions: rows });
}
