import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizePhone, isE164Phone } from "@/lib/auth/phone";
import { computeFinalPrice, resolvePlatformDiscountPercent } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendWhatsAppTextMessage } from "@/lib/wasender";

function computeCommission(total: number) {
  const commission = Math.round(total * 0.1);
  const organizerAmount = total - commission;
  return { commission, organizerAmount };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventId?: string;
      buyerPhone?: string;
      buyerName?: string;
    };

    const eventId = String(body.eventId ?? "").trim();
    const buyerPhone = normalizePhone(String(body.buyerPhone ?? ""));
    const buyerName = String(body.buyerName ?? "").trim() || "Client";

    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId requis." }, { status: 400 });
    }

    if (!isE164Phone(buyerPhone)) {
      return NextResponse.json(
        { success: false, error: "Numero Orange Money invalide (E.164)." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await getSessionFromRequestCookies();
    const platformDiscountPercent = await resolvePlatformDiscountPercent();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, date, price, official_price, organizer_price, status")
      .eq("id", eventId)
      .maybeSingle<{
        id: string;
        title: string;
        date: string;
        price: number;
        official_price: number;
        organizer_price: number;
        status: "draft" | "published" | "ended" | "cancelled";
      }>();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Evenement introuvable." },
        { status: 404 },
      );
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { success: false, error: "Evenement non disponible a la vente." },
        { status: 400 },
      );
    }

    if (new Date(event.date).getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: "Evenement deja passe." },
        { status: 400 },
      );
    }

    const organizerPrice = Number(event.organizer_price ?? event.price);
    const totalAmount = computeFinalPrice(organizerPrice, platformDiscountPercent);
    const { commission, organizerAmount } = computeCommission(totalAmount);

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        event_id: event.id,
        buyer_id: session?.userId ?? null,
        buyer_phone: buyerPhone,
        status: "pending",
      })
      .select("id")
      .single<{ id: string }>();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, error: "Creation ticket impossible." },
        { status: 500 },
      );
    }

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        ticket_id: ticket.id,
        event_id: event.id,
        buyer_phone: buyerPhone,
        total_amount: totalAmount,
        commission_amount: commission,
        organizer_amount: organizerAmount,
        status: "pending",
        currency: "XOF",
        payment_initiated_at: new Date().toISOString(),
        provider_payload: {
          mode: "ussd_manual",
          buyerName,
        },
      })
      .select("id, created_at")
      .single<{ id: string; created_at: string }>();

    if (txError || !tx) {
      return NextResponse.json(
        { success: false, error: "Creation transaction impossible." },
        { status: 500 },
      );
    }

    const supportPhone = process.env.SUPPORT_PHONE || "+22656636039";
    const adminPhone = process.env.ADMIN_ALERT_PHONE;

    const clientMessage =
      `Merci ${buyerName} ! Si vous avez effectue votre depot Orange Money, ` +
      `notre equipe verifie la transaction. Votre ticket sera envoye ici-meme des validation. ` +
      `Si l'attente depasse 10 min, appelez-nous au ${supportPhone}.`;

    await sendWhatsAppTextMessage({ to: buyerPhone, text: clientMessage });

    if (adminPhone) {
      const adminMessage =
        `🔔 ALERTE VENTE : ${buyerName} (${buyerPhone}) tente d'acheter un ticket pour ` +
        `${event.title}. Montant attendu : ${totalAmount} FCFA. ` +
        "Vérifie tes SMS Orange Money pour valider dans le dashboard.";

      await sendWhatsAppTextMessage({ to: adminPhone, text: adminMessage });
    }

    return NextResponse.json({
      success: true,
      message: "Paiement en cours de traitement.",
      transactionId: tx.id,
      finalAmount: totalAmount,
      supportPhone,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur sur initiate.",
      },
      { status: 500 },
    );
  }
}
