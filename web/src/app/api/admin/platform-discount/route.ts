import { NextResponse } from "next/server";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";
import { getPlatformDiscountFromEnv } from "@/lib/pricing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function normalizePercent(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value * 100) / 100;
  if (rounded < 0 || rounded > 100) {
    return null;
  }

  return rounded;
}

async function requireAdmin() {
  const session = await getSessionFromRequestCookies();

  if (!session || !normalizeRoles(session.roles).includes("admin")) {
    return { ok: false as const };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("platform_discount_percent")
    .eq("id", 1)
    .maybeSingle<{ platform_discount_percent: number }>();

  const envFallback = getPlatformDiscountFromEnv();
  const platformDiscountPercent = Number.isFinite(Number(data?.platform_discount_percent))
    ? Number(data?.platform_discount_percent)
    : envFallback;

  return NextResponse.json({
    success: true,
    platformDiscountPercent,
    envFallback,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: "Acces refuse." }, { status: 403 });
  }

  const body = (await request.json()) as { platformDiscountPercent?: number };
  const parsed = normalizePercent(Number(body.platformDiscountPercent ?? Number.NaN));

  if (parsed === null) {
    return NextResponse.json(
      { success: false, error: "La remise plateforme doit etre comprise entre 0 et 100." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .upsert({ id: 1, platform_discount_percent: parsed }, { onConflict: "id" })
    .select("platform_discount_percent")
    .single<{ platform_discount_percent: number }>();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Mise a jour de la remise plateforme impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Remise plateforme mise a jour.",
    platformDiscountPercent: Number(data.platform_discount_percent),
  });
}
