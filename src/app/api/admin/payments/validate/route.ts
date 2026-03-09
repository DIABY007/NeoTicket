import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { finalizeSuccessfulPayment } from "@/lib/payments/payment-workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as { transactionId?: string };
  const transactionId = String(body.transactionId ?? "").trim();

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

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const requestOrigin = new URL(request.url).origin;
  const publicBaseUrl =
    forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestOrigin;

  const finalized = await finalizeSuccessfulPayment({
    transactionId,
    providerPayload: { source: "admin_manual_validation", adminId: session.userId },
    source: "admin",
    publicBaseUrl,
  });

  return NextResponse.json({
    success: true,
    message: "Paiement valide. Ticket libere.",
    ...finalized,
  });
}
