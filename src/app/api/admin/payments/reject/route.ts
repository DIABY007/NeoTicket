import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { markTransactionFailed } from "@/lib/payments/payment-workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as { transactionId?: string; reason?: string };
  const transactionId = String(body.transactionId ?? "").trim();
  const reason = String(body.reason ?? "Tentative rejetee par admin").trim();

  if (!transactionId) {
    return NextResponse.json(
      { success: false, error: "transactionId requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("id", transactionId)
    .maybeSingle<{ id: string; status: "pending" | "success" | "failed" }>();

  if (txError || !tx) {
    return NextResponse.json(
      { success: false, error: "Transaction introuvable." },
      { status: 404 },
    );
  }

  if (tx.status !== "pending") {
    return NextResponse.json(
      { success: false, error: "Transaction deja traitee." },
      { status: 400 },
    );
  }

  await markTransactionFailed({
    transactionId,
    reason,
    payload: { source: "admin_manual_reject", adminId: session.userId },
    source: "admin",
  });

  return NextResponse.json({ success: true, message: "Transaction rejetee." });
}
