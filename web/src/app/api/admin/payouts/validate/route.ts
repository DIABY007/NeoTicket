import { NextResponse } from "next/server";

import { normalizeRoles } from "@/lib/auth/roles";
import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as { payoutId?: string; paymentReference?: string };
  const payoutId = String(body.payoutId ?? "").trim();
  const paymentReference = String(body.paymentReference ?? "").trim() || null;

  if (!payoutId) {
    return NextResponse.json({ success: false, error: "payoutId requis." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { data: payout, error: payoutError } = await supabase
    .from("payouts")
    .select("id, status")
    .eq("id", payoutId)
    .maybeSingle<{ id: string; status: "pending" | "paid" | "rejected" }>();

  if (payoutError || !payout) {
    return NextResponse.json({ success: false, error: "Demande de versement introuvable." }, { status: 404 });
  }

  if (payout.status !== "pending") {
    return NextResponse.json({ success: false, error: "Demande deja traitee." }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("payouts")
    .update({
      status: "paid",
      paid_at: now,
      approved_by: session.userId,
      payment_reference: paymentReference,
      notes: "Versement valide manuellement par admin.",
    })
    .eq("id", payoutId);

  if (updateError) {
    return NextResponse.json({ success: false, error: "Validation du versement impossible." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Versement valide avec succes.",
  });
}
