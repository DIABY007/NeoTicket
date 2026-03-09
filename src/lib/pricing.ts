import { getSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_PLATFORM_DISCOUNT_PERCENT = 0;
const PLATFORM_DISCOUNT_ENV_KEY = "PLATFORM_DISCOUNT_PERCENT";

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLATFORM_DISCOUNT_PERCENT;
  }

  return Math.min(100, Math.max(0, value));
}

export function getPlatformDiscountFromEnv() {
  const raw = process.env[PLATFORM_DISCOUNT_ENV_KEY];

  if (!raw) {
    return DEFAULT_PLATFORM_DISCOUNT_PERCENT;
  }

  const parsed = Number.parseFloat(raw);
  return clampPercent(parsed);
}

export async function resolvePlatformDiscountPercent() {
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("platform_settings")
    .select("platform_discount_percent")
    .eq("id", 1)
    .maybeSingle<{ platform_discount_percent: number }>();

  if (data && Number.isFinite(Number(data.platform_discount_percent))) {
    return clampPercent(Number(data.platform_discount_percent));
  }

  return getPlatformDiscountFromEnv();
}

export function computeFinalPrice(organizerPrice: number, platformDiscountPercent: number) {
  const safeOrganizerPrice = Math.max(0, Math.round(Number(organizerPrice)));
  const safePlatformPercent = clampPercent(Number(platformDiscountPercent));

  return Math.round(safeOrganizerPrice * (1 - safePlatformPercent / 100));
}

export function computeOrganizerDiscountPercent(officialPrice: number, organizerPrice: number) {
  if (!Number.isFinite(officialPrice) || officialPrice <= 0) {
    return 0;
  }

  const ratio = ((officialPrice - organizerPrice) / officialPrice) * 100;
  return Math.max(0, Math.round(ratio));
}
