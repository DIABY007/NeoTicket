import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_STATE_COOKIE,
  OTP_TTL_SECONDS,
} from "@/lib/auth/constants";
import { checkSendOtpRateLimit, registerOtpSend } from "@/lib/auth/rate-limit";
import { isE164Phone, normalizePhone } from "@/lib/auth/phone";
import { createOtpStateToken, generateOtpCode } from "@/lib/auth/otp";
import { sendOtpWhatsApp } from "@/lib/wasender";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string };
    const normalizedPhone = normalizePhone(body.phone ?? "");

    if (!isE164Phone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: "Numero invalide. Format E.164 requis." },
        { status: 400 },
      );
    }

    const limit = checkSendOtpRateLimit(normalizedPhone);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            limit.reason === "cooldown"
              ? "Veuillez patienter avant de renvoyer un code."
              : "Limite atteinte: 3 envois maximum par heure.",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const secret = process.env.OTP_SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "OTP_SIGNING_SECRET manquant." },
        { status: 500 },
      );
    }

    const code = generateOtpCode();
    const token = createOtpStateToken(normalizedPhone, code, secret);

    await sendOtpWhatsApp({ to: normalizedPhone, code });
    registerOtpSend(normalizedPhone);

    const cookieStore = await cookies();
    cookieStore.set(OTP_STATE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OTP_TTL_SECONDS,
    });

    return NextResponse.json({
      success: true,
      message: "Code OTP envoye.",
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Impossible d'envoyer le code OTP pour le moment.",
      },
      { status: 500 },
    );
  }
}
