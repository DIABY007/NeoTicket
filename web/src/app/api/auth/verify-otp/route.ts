import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE,
  APP_SESSION_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_STATE_COOKIE,
  OTP_TTL_SECONDS,
} from "@/lib/auth/constants";
import { createAppSessionToken } from "@/lib/auth/session";
import {
  encodeOtpPayload,
  parseOtpStateToken,
  verifyOtpStateToken,
} from "@/lib/auth/otp";
import { getRouteForRole, pickPrimaryRole } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type UserRecord = {
  id: string;
  phone: string;
  display_name: string | null;
  roles: string[] | null;
  status: "active" | "invited" | "blocked";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; name?: string };
    const code = (body.code ?? "").trim();
    const normalizedDisplayName = String(body.name ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Le code OTP doit contenir 6 chiffres." },
        { status: 400 },
      );
    }

    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "OTP_SIGNING_SECRET manquant." },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(OTP_STATE_COOKIE)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Session OTP absente ou expiree." },
        { status: 401 },
      );
    }

    const verified = verifyOtpStateToken(token, code, secret);

    if (!verified.ok) {
      if (verified.reason === "invalid_code" && verified.payload) {
        const updatedToken = encodeOtpPayload(verified.payload, secret);
        cookieStore.set(OTP_STATE_COOKIE, updatedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: OTP_TTL_SECONDS,
        });

        const remainingAttempts = Math.max(
          0,
          OTP_MAX_ATTEMPTS - verified.payload.attemptsUsed,
        );

        return NextResponse.json(
          {
            success: false,
            error: "Code OTP invalide.",
            remainingAttempts,
          },
          { status: 401 },
        );
      }

      if (verified.reason === "locked") {
        cookieStore.delete(OTP_STATE_COOKIE);
        return NextResponse.json(
          {
            success: false,
            error: "Trop de tentatives. Veuillez recommencer.",
          },
          { status: 401 },
        );
      }

      cookieStore.delete(OTP_STATE_COOKIE);
      return NextResponse.json(
        { success: false, error: "Code OTP invalide ou expire." },
        { status: 401 },
      );
    }

    const parsedPayload = parseOtpStateToken(token, secret);
    if (!parsedPayload) {
      cookieStore.delete(OTP_STATE_COOKIE);
      return NextResponse.json(
        { success: false, error: "Session OTP invalide." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id, phone, display_name, roles, status")
      .eq("phone", parsedPayload.phone)
      .maybeSingle<UserRecord>();

    if (existingUserError) {
      return NextResponse.json(
        { success: false, error: "Erreur de lecture utilisateur." },
        { status: 500 },
      );
    }

    let user = existingUser;

    if (!user) {
      if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 80) {
        return NextResponse.json(
          {
            success: false,
            error: "Entrez votre nom (2 a 80 caracteres) pour finaliser la premiere connexion.",
          },
          { status: 400 },
        );
      }

      const { data: createdUser, error: createdUserError } = await supabase
        .from("users")
        .insert({
          phone: parsedPayload.phone,
          display_name: normalizedDisplayName,
          roles: ["buyer", "organizer"],
          status: "active",
        })
        .select("id, phone, display_name, roles, status")
        .single<UserRecord>();

      if (createdUserError) {
        return NextResponse.json(
          { success: false, error: "Creation utilisateur impossible." },
          { status: 500 },
        );
      }

      user = createdUser;
    }

    if (user && !user.display_name && normalizedDisplayName.length >= 2) {
      const { data: updatedUser } = await supabase
        .from("users")
        .update({ display_name: normalizedDisplayName })
        .eq("id", user.id)
        .select("id, phone, display_name, roles, status")
        .single<UserRecord>();

      if (updatedUser) {
        user = updatedUser;
      }
    }

    if (user.status === "blocked") {
      cookieStore.delete(OTP_STATE_COOKIE);
      return NextResponse.json(
        {
          success: false,
          error: "Ce compte est bloque. Contactez le support.",
        },
        { status: 403 },
      );
    }

    const sessionToken = createAppSessionToken({
      userId: user.id,
      phone: user.phone,
      displayName: user.display_name,
      roles: user.roles ?? ["buyer"],
      secret,
    });

    cookieStore.set(APP_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: APP_SESSION_TTL_SECONDS,
    });

    cookieStore.delete(OTP_STATE_COOKIE);

    const normalizedRoles = user.roles ?? ["buyer"];
    const redirectTo = getRouteForRole(pickPrimaryRole(normalizedRoles));

    return NextResponse.json({
      success: true,
      message: "OTP verifie avec succes.",
      redirectTo,
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.display_name,
        roles: normalizedRoles,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de verifier le code OTP." },
      { status: 500 },
    );
  }
}
