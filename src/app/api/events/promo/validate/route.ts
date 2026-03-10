import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/events/promo/validate?eventId=xxx&code=YYY
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const code = url.searchParams.get("code")?.trim().toUpperCase();

  if (!eventId || !code) {
    return NextResponse.json(
      { success: false, error: "eventId et code requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id, code, discount_percent, max_uses, current_uses, expires_at, is_active")
    .eq("event_id", eventId)
    .ilike("code", code)
    .maybeSingle<{
      id: string;
      code: string;
      discount_percent: number;
      max_uses: number;
      current_uses: number;
      expires_at: string | null;
      is_active: boolean;
    }>();

  if (!promo) {
    return NextResponse.json(
      { success: false, error: "Code promo invalide." },
      { status: 404 },
    );
  }

  if (!promo.is_active) {
    return NextResponse.json(
      { success: false, error: "Ce code promo est desactive." },
      { status: 400 },
    );
  }

  if (promo.current_uses >= promo.max_uses) {
    return NextResponse.json(
      { success: false, error: "Ce code promo a atteint son quota." },
      { status: 400 },
    );
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { success: false, error: "Ce code promo a expire." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    promoCodeId: promo.id,
    code: promo.code,
    discountPercent: promo.discount_percent,
  });
}
