import crypto from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendTicketWhatsApp, sendWhatsAppTextMessage } from "@/lib/wasender";

type FinalizeSuccessInput = {
  transactionId: string;
  providerReference?: string;
  orderId?: string;
  paymentId?: string;
  providerPayload: unknown;
  source: "verify" | "webhook" | "admin";
  publicBaseUrl?: string;
};

function resolvePublicBaseUrl(override?: string) {
  const candidates = [
    override,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_PUBLIC_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (!value) continue;
    return value.replace(/\/$/, "");
  }

  return undefined;
}

export async function finalizeSuccessfulPayment(input: FinalizeSuccessInput) {
  const supabase = getSupabaseServerClient();

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, ticket_id, event_id, buyer_phone, status")
    .eq("id", input.transactionId)
    .single<{
      id: string;
      ticket_id: string;
      event_id: string;
      buyer_phone: string;
      status: "pending" | "success" | "failed";
    }>();

  if (txError || !transaction) {
    throw new Error("Transaction introuvable pour finalisation.");
  }

  const now = new Date().toISOString();
  const qrHash = crypto.randomUUID().replace(/-/g, "");

  if (transaction.status !== "success") {
    const { error: updateTxError } = await supabase
      .from("transactions")
      .update({
        status: "success",
        provider_reference: input.providerReference ?? null,
        om_order_id: input.orderId ?? null,
        om_payment_id: input.paymentId ?? null,
        paid_at: now,
        otp_verified_at: input.source === "verify" ? now : null,
        webhook_received_at: input.source === "webhook" ? now : null,
        webhook_verified: input.source === "webhook",
        provider_payload: input.providerPayload,
        failure_reason: null,
        failed_at: null,
      })
      .eq("id", input.transactionId);

    if (updateTxError) {
      throw new Error("Mise a jour transaction success impossible.");
    }
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, qr_code_hash, status")
    .eq("id", transaction.ticket_id)
    .single<{ id: string; qr_code_hash: string | null; status: string }>();

  if (ticketError || !ticket) {
    throw new Error("Ticket introuvable pour finalisation.");
  }

  const ticketQrHash = ticket.qr_code_hash ?? qrHash;

  const { error: updateTicketError } = await supabase
    .from("tickets")
    .update({
      status: "paid",
      qr_code_hash: ticketQrHash,
      qr_generated_at: now,
      payment_confirmed_at: now,
      updated_by_webhook: input.source === "webhook",
    })
    .eq("id", ticket.id);

  if (updateTicketError) {
    throw new Error("Mise a jour ticket paid impossible.");
  }

  const appUrl = resolvePublicBaseUrl(input.publicBaseUrl);
  const qrLink = appUrl ? `${appUrl}/api/qr/${ticket.id}` : undefined;

  const { data: event } = await supabase
    .from("events")
    .select("title, date, organizer_id, users!events_organizer_id_fkey(phone)")
    .eq("id", transaction.event_id)
    .maybeSingle<{
      title: string;
      date: string;
      organizer_id: string;
      users: { phone: string | null } | { phone: string | null }[] | null;
    }>();

  let deliveryError: string | null = null;

  try {
    await sendTicketWhatsApp({
      to: transaction.buyer_phone,
      eventTitle: event?.title ?? "Evenement NeoTicket",
      eventDate: event?.date,
      qrHash: ticketQrHash,
      qrLink,
    });
  } catch (error) {
    deliveryError = error instanceof Error ? error.message : "Envoi WhatsApp impossible";
  }

  const { error: updateDeliveryError } = await supabase
    .from("tickets")
    .update({
      qr_delivered_via: "whatsapp",
      qr_delivered_at: deliveryError ? null : now,
      qr_delivery_error: deliveryError,
    })
    .eq("id", ticket.id);

  if (updateDeliveryError) {
    throw new Error("Mise a jour livraison ticket impossible.");
  }

  const organizerRecord = event?.users
    ? Array.isArray(event.users)
      ? event.users[0]
      : event.users
    : null;
  const organizerPhone = organizerRecord?.phone ?? null;

  if (organizerPhone) {
    const organizerMessage =
      `💰 Bonne nouvelle ! Une nouvelle place vient d'être vendue pour ton événement ` +
      `${event?.title ?? "NeoTicket"}. On continue comme ça ! 🚀`;

    try {
      await sendWhatsAppTextMessage({ to: organizerPhone, text: organizerMessage });
    } catch {
      // Optional notification: ignore delivery failures to avoid blocking payment finalization.
    }
  }

  return {
    transactionId: transaction.id,
    ticketId: ticket.id,
    qrHash: ticketQrHash,
    qrLink,
    whatsappDelivered: !deliveryError,
    whatsappError: deliveryError,
  };
}

export async function markTransactionFailed(input: {
  transactionId: string;
  reason: string;
  payload?: unknown;
  source: "verify" | "webhook" | "initiate" | "admin";
}) {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: tx } = await supabase
    .from("transactions")
    .select("ticket_id, buyer_phone, event_id")
    .eq("id", input.transactionId)
    .maybeSingle<{ ticket_id: string; buyer_phone: string | null; event_id: string | null }>();

  const { error } = await supabase
    .from("transactions")
    .update({
      status: "failed",
      failed_at: now,
      failure_reason: input.reason,
      provider_payload: input.payload ?? null,
      webhook_received_at: input.source === "webhook" ? now : null,
      webhook_verified: input.source === "webhook",
    })
    .eq("id", input.transactionId);

  if (error) {
    throw new Error("Mise a jour transaction failed impossible.");
  }

  if (tx?.buyer_phone) {
    const supportPhone = process.env.SUPPORT_PHONE || "+22656636039";
    const { data: event } = tx.event_id
      ? await supabase
          .from("events")
          .select("title")
          .eq("id", tx.event_id)
          .maybeSingle<{ title: string }>()
      : { data: null };

    const clientMessage =
      `❌ Oups ! Nous n'avons pas pu confirmer ton paiement pour ${event?.title ?? "ton événement"}. ` +
      `Si tu penses qu'il y a une erreur, merci de nous envoyer une capture d'écran de ton reçu Orange Money ` +
      `ou de nous appeler au ${supportPhone}.`;

    try {
      await sendWhatsAppTextMessage({ to: tx.buyer_phone, text: clientMessage });
    } catch {
      // Rejection state is authoritative; WhatsApp delivery errors should not block it.
    }
  }

  if (tx?.ticket_id) {
    await supabase
      .from("tickets")
      .update({ status: "cancelled" })
      .eq("id", tx.ticket_id);
  }
}
