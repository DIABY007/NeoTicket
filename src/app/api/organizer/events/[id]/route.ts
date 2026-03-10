import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { buildMarketingSlug, normalizeEventSlug } from "@/lib/event-slug";
import { normalizeRoles } from "@/lib/auth/roles";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventRecord = {
  id: string;
  slug: string;
  organizer_id: string;
  title: string;
  description: string | null;
  city: string | null;
  date: string;
  end_date: string | null;
  price: number;
  official_price: number;
  organizer_price: number;
  status: "draft" | "published" | "ended" | "cancelled";
  image_url: string | null;
};

async function resolveUniqueSlug({
  supabase,
  requestedSlug,
  title,
  city,
  date,
  excludeEventId,
}: {
  supabase: ReturnType<typeof getSupabaseServerClient>;
  requestedSlug: string;
  title: string;
  city: string;
  date: Date;
  excludeEventId: string;
}) {
  const base =
    normalizeEventSlug(requestedSlug) ||
    buildMarketingSlug({ title, city, date: date.toISOString() });

  if (!base) {
    return null;
  }

  let candidate = base;
  for (let i = 0; i < 30; i += 1) {
    const { data, error } = await supabase
      .from("events")
      .select("id")
      .eq("slug", candidate)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (error) {
      return null;
    }

    if (!data || data.id === excludeEventId) {
      return candidate;
    }

    candidate = `${base}-${i + 2}`;
  }

  return null;
}

async function getSession() {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    return { error: "Secret manquant.", status: 500 as const };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return { error: "Session absente.", status: 401 as const };
  }

  const session = parseAppSessionToken(sessionToken, secret);
  if (!session) {
    cookieStore.delete(APP_SESSION_COOKIE);
    return { error: "Session invalide.", status: 401 as const };
  }

  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getSession();
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const roles = normalizeRoles(auth.session.roles);
  const isAdmin = roles.includes("admin");

  let query = supabase
    .from("events")
    .select("id, slug, organizer_id, title, description, city, date, end_date, price, official_price, organizer_price, status, image_url")
    .eq("id", id)
    .limit(1);

  if (!isAdmin) {
    query = query.eq("organizer_id", auth.session.userId);
  }

  const { data, error } = await query.maybeSingle<EventRecord>();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Lecture evenement impossible." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, event: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getSession();
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const roles = normalizeRoles(auth.session.roles);
  const canEditEvent = roles.includes("organizer") || roles.includes("admin");
  if (!canEditEvent) {
    return NextResponse.json(
      { success: false, error: "Acces refuse: role organisateur requis." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    city?: string;
    startDate?: string;
    endDate?: string | null;
    officialPrice?: number;
    organizerPrice?: number;
    isFreeEvent?: boolean;
    slug?: string;
    status?: "draft" | "published" | "ended" | "cancelled";
  };

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const city = String(body.city ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const startDateRaw = String(body.startDate ?? "").trim();
  const endDateRaw = String(body.endDate ?? "").trim();
  const officialPrice = Number(body.officialPrice ?? NaN);
  const organizerPrice = Number(body.organizerPrice ?? NaN);
  const requestedSlug = String(body.slug ?? "").trim();
  const status = body.status;

  if (!title) {
    return NextResponse.json(
      { success: false, error: "Le titre est obligatoire." },
      { status: 400 },
    );
  }

  if (city.length < 2 || city.length > 120) {
    return NextResponse.json(
      { success: false, error: "La ville est obligatoire (2 a 120 caracteres)." },
      { status: 400 },
    );
  }

  const startDate = new Date(startDateRaw);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { success: false, error: "La date de debut est invalide." },
      { status: 400 },
    );
  }

  let endDate: Date | null = null;
  if (endDateRaw) {
    endDate = new Date(endDateRaw);
    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "La date de fin est invalide." },
        { status: 400 },
      );
    }

    if (endDate.getTime() < startDate.getTime()) {
      return NextResponse.json(
        { success: false, error: "La date de fin doit etre apres la date de debut." },
        { status: 400 },
      );
    }
  }

  if (!Number.isFinite(officialPrice) || officialPrice < 0) {
    return NextResponse.json(
      { success: false, error: "Le prix officiel doit etre un entier positif ou zero." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(organizerPrice) || organizerPrice < 0) {
    return NextResponse.json(
      { success: false, error: "Le prix promo organisateur doit etre un entier positif ou zero." },
      { status: 400 },
    );
  }

  const isFreeEvent = officialPrice === 0 || organizerPrice === 0 || body.isFreeEvent === true;
  if (isFreeEvent && !(officialPrice === 0 && organizerPrice === 0)) {
    return NextResponse.json(
      {
        success: false,
        error: "Mode gratuit invalide: mettez les deux prix a 0, ou renseignez deux prix positifs.",
      },
      { status: 400 },
    );
  }

  if (organizerPrice > officialPrice) {
    return NextResponse.json(
      {
        success: false,
        error: "Le prix promo organisateur ne peut pas depasser le prix officiel.",
      },
      { status: 400 },
    );
  }

  const allowedStatus = ["draft", "published", "ended", "cancelled"];
  if (!status || !allowedStatus.includes(status)) {
    return NextResponse.json(
      { success: false, error: "Statut evenement invalide." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const slug = await resolveUniqueSlug({
    supabase,
    requestedSlug,
    title,
    city,
    date: startDate,
    excludeEventId: id,
  });

  if (!slug) {
    return NextResponse.json(
      { success: false, error: "Slug invalide ou deja utilise." },
      { status: 400 },
    );
  }

  const isAdmin = roles.includes("admin");

  let updateQuery = supabase
    .from("events")
    .update({
      title,
      slug,
      description: description || null,
      city,
      date: startDate.toISOString(),
      end_date: endDate ? endDate.toISOString() : null,
      price: Math.round(organizerPrice),
      official_price: Math.round(officialPrice),
      organizer_price: Math.round(organizerPrice),
      status,
    })
    .eq("id", id)
    .select("id, slug, organizer_id, title, description, city, date, end_date, price, official_price, organizer_price, status, image_url")
    .limit(1);

  if (!isAdmin) {
    updateQuery = updateQuery.eq("organizer_id", auth.session.userId);
  }

  const { data, error } = await updateQuery.maybeSingle<EventRecord>();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Mise a jour evenement impossible." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, event: data });
}
