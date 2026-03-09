import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { buildMarketingSlug, normalizeEventSlug } from "@/lib/event-slug";
import { normalizeRoles } from "@/lib/auth/roles";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

async function resolveUniqueSlug({
  supabase,
  requestedSlug,
  title,
  city,
  date,
}: {
  supabase: ReturnType<typeof getSupabaseServerClient>;
  requestedSlug: string;
  title: string;
  city: string;
  date: Date;
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

    if (!data) {
      return candidate;
    }

    candidate = `${base}-${i + 2}`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.OTP_SIGNING_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!secret || !supabaseUrl) {
      return NextResponse.json(
        { success: false, error: "Configuration serveur manquante." },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(APP_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Session absente." },
        { status: 401 },
      );
    }

    const session = parseAppSessionToken(sessionToken, secret);
    if (!session) {
      cookieStore.delete(APP_SESSION_COOKIE);
      return NextResponse.json(
        { success: false, error: "Session invalide." },
        { status: 401 },
      );
    }

    const roles = normalizeRoles(session.roles);
    const canCreateEvent = roles.includes("organizer") || roles.includes("admin");

    if (!canCreateEvent) {
      return NextResponse.json(
        {
          success: false,
          error: "Acces refuse: role organisateur requis.",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const city = String(formData.get("city") ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const startDateRaw = String(formData.get("startDate") ?? "").trim();
    const endDateRaw = String(formData.get("endDate") ?? "").trim();
    const venue = String(formData.get("venue") ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const officialPriceRaw = String(formData.get("officialPrice") ?? "").trim();
    const organizerPriceRaw = String(formData.get("organizerPrice") ?? "").trim();
    const slugRaw = String(formData.get("slug") ?? "").trim();
    const omReceiverPhoneRaw = String(formData.get("omReceiverPhone") ?? "").trim();
    const file = formData.get("image");

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
          {
            success: false,
            error: "La date de fin doit etre superieure a la date de debut.",
          },
          { status: 400 },
        );
      }
    }

    const officialPrice = Number.parseInt(officialPriceRaw, 10);
    const organizerPrice = Number.parseInt(organizerPriceRaw, 10);

    if (!Number.isFinite(officialPrice) || officialPrice <= 0) {
      return NextResponse.json(
        { success: false, error: "Le prix officiel doit etre un entier positif." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(organizerPrice) || organizerPrice <= 0) {
      return NextResponse.json(
        { success: false, error: "Le prix promo organisateur doit etre un entier positif." },
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

    let omReceiverPhone: string | null = null;
    if (omReceiverPhoneRaw) {
      if (!/^\+[1-9][0-9]{6,14}$/.test(omReceiverPhoneRaw)) {
        return NextResponse.json(
          { success: false, error: "Le numero Orange Money est invalide (format E.164 attendu)." },
          { status: 400 },
        );
      }
      omReceiverPhone = omReceiverPhoneRaw;
    }

    if (venue && venue.length > 200) {
      return NextResponse.json(
        { success: false, error: "Le lieu precis ne peut pas depasser 200 caracteres." },
        { status: 400 },
      );
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json(
        { success: false, error: "L'image de l'evenement est obligatoire." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Le fichier doit etre une image." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image trop volumineuse (max 5MB)." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const slug = await resolveUniqueSlug({
      supabase,
      requestedSlug: slugRaw,
      title,
      city,
      date: startDate,
    });

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Slug invalide ou indisponible. Essayez une variante.",
        },
        { status: 400 },
      );
    }

    const bucket = process.env.SUPABASE_STORAGE_EVENTS_BUCKET || "event-posters";

    const eventId = crypto.randomUUID();
    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ".jpg";
    const baseName = file.name.includes(".")
      ? file.name.slice(0, file.name.lastIndexOf("."))
      : file.name;
    const objectPath = `${session.userId}/${eventId}/${Date.now()}-${sanitizeFilename(baseName)}${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Upload image impossible. Verifiez le bucket storage (event-posters) et ses permissions.",
          details: uploadError.message,
        },
        { status: 500 },
      );
    }

    const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;

    const { data, error } = await supabase
      .from("events")
      .insert({
        id: eventId,
        organizer_id: session.userId,
        title,
        description: description || null,
        city,
        slug,
        venue: venue || null,
        date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        price: organizerPrice,
        official_price: officialPrice,
        organizer_price: organizerPrice,
        om_receiver_phone: omReceiverPhone,
        image_url: imageUrl,
        status: "published",
      })
      .select("id, slug, title, date, end_date, price, official_price, organizer_price, city, venue, om_receiver_phone, status, image_url")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Creation evenement impossible.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Evenement cree avec succes.",
      event: data,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur inattendue lors de la creation de l'evenement." },
      { status: 500 },
    );
  }
}
