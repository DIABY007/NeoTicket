import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { normalizeRoles } from "@/lib/auth/roles";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function getOrganizerSession() {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Configuration serveur manquante." },
        { status: 500 },
      ),
    };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Session absente." },
        { status: 401 },
      ),
    };
  }

  const session = parseAppSessionToken(sessionToken, secret);
  if (!session) {
    cookieStore.delete(APP_SESSION_COOKIE);
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Session invalide." },
        { status: 401 },
      ),
    };
  }

  const roles = normalizeRoles(session.roles);
  if (!roles.includes("organizer") && !roles.includes("admin")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Acces refuse." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, session };
}

// GET /api/organizer/marketing?eventId=xxx
export async function GET(request: Request) {
  const auth = await getOrganizerSession();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { success: false, error: "eventId est requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id, slug")
    .eq("id", eventId)
    .maybeSingle<{ id: string; organizer_id: string; slug: string | null }>();

  if (!event) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  if (event.organizer_id !== auth.session.userId) {
    return NextResponse.json(
      { success: false, error: "Acces non autorise." },
      { status: 403 },
    );
  }

  const [promoResult, affiliateResult] = await Promise.all([
    supabase
      .from("promo_codes")
      .select("id, code, discount_percent, max_uses, current_uses, expires_at, is_active, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("affiliates")
      .select("id, ambassador_name, ref_code, sales_count, created_at")
      .eq("event_id", eventId)
      .order("sales_count", { ascending: false }),
  ]);

  return NextResponse.json({
    success: true,
    eventSlug: event.slug ?? null,
    promoCodes: promoResult.data ?? [],
    affiliates: affiliateResult.data ?? [],
  });
}

// POST /api/organizer/marketing
export async function POST(request: Request) {
  const auth = await getOrganizerSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    action?: string;
    eventId?: string;
    // promo code fields
    code?: string;
    discountPercent?: number;
    maxUses?: number;
    expiresAt?: string;
    // affiliate fields
    ambassadorName?: string;
    refCode?: string;
    // toggle
    promoCodeId?: string;
    isActive?: boolean;
  };

  const action = String(body.action ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();

  if (!eventId) {
    return NextResponse.json(
      { success: false, error: "eventId est requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .maybeSingle<{ id: string; organizer_id: string }>();

  if (!event) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  if (event.organizer_id !== auth.session.userId) {
    return NextResponse.json(
      { success: false, error: "Acces non autorise." },
      { status: 403 },
    );
  }

  if (action === "create_promo") {
    const code = String(body.code ?? "").trim().toUpperCase();
    const discountPercent = Number(body.discountPercent ?? 0);
    const maxUses = Number(body.maxUses ?? 0);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;

    if (!code || code.length < 3 || code.length > 30) {
      return NextResponse.json(
        { success: false, error: "Code promo invalide (3-30 caracteres)." },
        { status: 400 },
      );
    }

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Code promo: lettres, chiffres, tirets uniquement." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return NextResponse.json(
        { success: false, error: "Reduction entre 1% et 100%." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(maxUses) || maxUses < 1) {
      return NextResponse.json(
        { success: false, error: "Nombre d'utilisations max invalide." },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from("promo_codes")
      .select("id")
      .eq("event_id", eventId)
      .ilike("code", code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ce code promo existe deja pour cet evenement." },
        { status: 409 },
      );
    }

    const { data: promo, error: insertErr } = await supabase
      .from("promo_codes")
      .insert({
        event_id: eventId,
        code,
        discount_percent: discountPercent,
        max_uses: maxUses,
        expires_at: expiresAt,
        is_active: true,
      })
      .select("id, code, discount_percent, max_uses, current_uses, expires_at, is_active")
      .single();

    if (insertErr || !promo) {
      return NextResponse.json(
        { success: false, error: "Creation code promo impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, promoCode: promo });
  }

  if (action === "toggle_promo") {
    const promoCodeId = String(body.promoCodeId ?? "").trim();
    const isActive = Boolean(body.isActive);

    if (!promoCodeId) {
      return NextResponse.json(
        { success: false, error: "promoCodeId requis." },
        { status: 400 },
      );
    }

    const { error: updateErr } = await supabase
      .from("promo_codes")
      .update({ is_active: isActive })
      .eq("id", promoCodeId)
      .eq("event_id", eventId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: "Mise a jour impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "create_affiliate") {
    const ambassadorName = String(body.ambassadorName ?? "").trim();
    const refCode = String(body.refCode ?? "").trim().toLowerCase();

    if (!ambassadorName || ambassadorName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Nom ambassadeur invalide (2 caracteres min)." },
        { status: 400 },
      );
    }

    if (!refCode || refCode.length < 3 || refCode.length > 30) {
      return NextResponse.json(
        { success: false, error: "Code referent invalide (3-30 caracteres)." },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9_-]+$/.test(refCode)) {
      return NextResponse.json(
        { success: false, error: "Code referent: lettres minuscules, chiffres, tirets uniquement." },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from("affiliates")
      .select("id")
      .eq("event_id", eventId)
      .ilike("ref_code", refCode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ce code referent existe deja pour cet evenement." },
        { status: 409 },
      );
    }

    const { data: affiliate, error: insertErr } = await supabase
      .from("affiliates")
      .insert({
        event_id: eventId,
        ambassador_name: ambassadorName,
        ref_code: refCode,
      })
      .select("id, ambassador_name, ref_code, sales_count")
      .single();

    if (insertErr || !affiliate) {
      return NextResponse.json(
        { success: false, error: "Creation ambassadeur impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, affiliate });
  }

  return NextResponse.json(
    { success: false, error: "Action inconnue." },
    { status: 400 },
  );
}
