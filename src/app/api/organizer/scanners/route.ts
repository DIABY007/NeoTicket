import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { normalizeRoles } from "@/lib/auth/roles";
import { normalizePhone, isE164Phone } from "@/lib/auth/phone";
import { parseAppSessionToken } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EventOwnerRow = {
  id: string;
  title: string;
  organizer_id: string;
};

type UserRow = {
  id: string;
  phone: string;
  roles: string[] | null;
  status: "active" | "invited" | "blocked";
};

function uniqueRoles(roles: string[]) {
  return Array.from(new Set(roles));
}

async function getAuthorizedSession() {
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

export async function GET(request: Request) {
  const auth = await getAuthorizedSession();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { success: false, error: "eventId est requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, organizer_id")
    .eq("id", eventId)
    .maybeSingle<EventOwnerRow>();

  if (eventError || !event) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  if (event.organizer_id !== auth.session.userId) {
    return NextResponse.json(
      { success: false, error: "Acces non autorise a cet evenement." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("event_scanners")
    .select("user_id, users!inner(id, phone, roles, status)")
    .eq("event_id", eventId);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Lecture des scanneurs impossible." },
      { status: 500 },
    );
  }

  const scanners = (data ?? [])
    .map((row: { users: UserRow | UserRow[] }) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        phone: user.phone,
        roles: user.roles ?? [],
        status: user.status,
      };
    })
    .filter((value): value is { id: string; phone: string; roles: string[]; status: "active" | "invited" | "blocked" } => Boolean(value));

  return NextResponse.json({ success: true, scanners });
}

export async function POST(request: Request) {
  const auth = await getAuthorizedSession();
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json()) as {
    eventId?: string;
    phone?: string;
  };

  const eventId = String(body.eventId ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));

  if (!eventId) {
    return NextResponse.json(
      { success: false, error: "eventId est requis." },
      { status: 400 },
    );
  }

  if (!isE164Phone(phone)) {
    return NextResponse.json(
      { success: false, error: "Numero invalide. Format E.164 requis." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, organizer_id")
    .eq("id", eventId)
    .maybeSingle<EventOwnerRow>();

  if (eventError || !event) {
    return NextResponse.json(
      { success: false, error: "Evenement introuvable." },
      { status: 404 },
    );
  }

  if (event.organizer_id !== auth.session.userId) {
    return NextResponse.json(
      { success: false, error: "Acces non autorise a cet evenement." },
      { status: 403 },
    );
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id, phone, roles, status")
    .eq("phone", phone)
    .maybeSingle<UserRow>();

  if (existingUserError) {
    return NextResponse.json(
      { success: false, error: "Lecture utilisateur impossible." },
      { status: 500 },
    );
  }

  if (!existingUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Compte indisponible: aucun compte associe a ce numero.",
      },
      { status: 404 },
    );
  }

  if (existingUser.status === "blocked") {
    return NextResponse.json(
      {
        success: false,
        error: "Ce numero est bloque et ne peut pas etre invite.",
      },
      { status: 403 },
    );
  }

  const mergedRoles = uniqueRoles([...(existingUser.roles ?? []), "scanner"]);

  const { data: updatedUser, error: updateUserError } = await supabase
    .from("users")
    .update({ roles: mergedRoles })
    .eq("id", existingUser.id)
    .select("id, phone, roles, status")
    .single<UserRow>();

  if (updateUserError || !updatedUser) {
    return NextResponse.json(
      { success: false, error: "Mise a jour role scanneur impossible." },
      { status: 500 },
    );
  }

  const scannerUser = updatedUser;

  const { error: linkError } = await supabase
    .from("event_scanners")
    .upsert(
      {
        event_id: eventId,
        user_id: scannerUser.id,
      },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    );

  if (linkError) {
    return NextResponse.json(
      { success: false, error: "Association scanneur/evenement impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Compte trouve: scanneur ajoute automatiquement.",
    scanner: {
      id: scannerUser.id,
      phone: scannerUser.phone,
      roles: scannerUser.roles ?? [],
      status: scannerUser.status,
    },
  });
}
