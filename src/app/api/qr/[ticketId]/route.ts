import QRCode from "qrcode";
import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ticketId } = await context.params;

  if (!ticketId) {
    return NextResponse.json({ success: false, error: "ticketId requis." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("qr_code_hash, status")
    .eq("id", ticketId)
    .maybeSingle<{ qr_code_hash: string | null; status: string }>();

  if (error || !ticket) {
    return NextResponse.json({ success: false, error: "Ticket introuvable." }, { status: 404 });
  }

  if (!ticket.qr_code_hash) {
    return NextResponse.json({ success: false, error: "QR indisponible." }, { status: 400 });
  }

  const pngBuffer = await QRCode.toBuffer(ticket.qr_code_hash, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
