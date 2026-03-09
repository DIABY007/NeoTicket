import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE, APP_SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { createAppSessionToken, parseAppSessionToken } from "@/lib/auth/session";
import { isE164Phone, normalizePhone } from "@/lib/auth/phone";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type UserRecord = {
  id: string;
  phone: string;
  display_name: string | null;
  roles: string[] | null;
};

export async function PATCH(request: Request) {
  try {
    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: "Secret manquant." }, { status: 500 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(APP_SESSION_COOKIE)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
    }

    const session = parseAppSessionToken(token, secret);
    if (!session) {
      cookieStore.delete(APP_SESSION_COOKIE);
      return NextResponse.json({ success: false, error: "Session invalide." }, { status: 401 });
    }

    const body = (await request.json()) as {
      displayName?: string | null;
      phone?: string;
    };

    const normalizedDisplayName = String(body.displayName ?? "")
      .trim()
      .replace(/\s+/g, " ");

    const nextDisplayName =
      normalizedDisplayName.length === 0 ? null : normalizedDisplayName;

    if (nextDisplayName && (nextDisplayName.length < 2 || nextDisplayName.length > 80)) {
      return NextResponse.json(
        { success: false, error: "Le nom doit contenir entre 2 et 80 caracteres." },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(String(body.phone ?? ""));
    if (!isE164Phone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: "Numero invalide. Format E.164 requis." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update({
        display_name: nextDisplayName,
        phone: normalizedPhone,
      })
      .eq("id", session.userId)
      .select("id, phone, display_name, roles")
      .single<UserRecord>();

    if (error || !updatedUser) {
      if (error?.code === "23505") {
        return NextResponse.json(
          { success: false, error: "Ce numero est deja utilise par un autre compte." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { success: false, error: "Mise a jour profil impossible." },
        { status: 500 },
      );
    }

    const sessionToken = createAppSessionToken({
      userId: updatedUser.id,
      phone: updatedUser.phone,
      displayName: updatedUser.display_name,
      roles: updatedUser.roles ?? ["buyer"],
      secret,
    });

    cookieStore.set(APP_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: APP_SESSION_TTL_SECONDS,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        displayName: updatedUser.display_name,
        roles: updatedUser.roles ?? ["buyer"],
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erreur inattendue pendant la mise a jour profil." },
      { status: 500 },
    );
  }
}
