import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { normalizeRoles } from "@/lib/auth/roles";
import { parseAppSessionToken } from "@/lib/auth/session";

export async function GET() {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Secret manquant." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: "Session absente." }, { status: 401 });
  }

  const payload = parseAppSessionToken(token, secret);
  if (!payload) {
    cookieStore.delete(APP_SESSION_COOKIE);
    return NextResponse.json({ success: false, error: "Session invalide." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: payload.userId,
      phone: payload.phone,
      displayName: payload.displayName ?? null,
      roles: normalizeRoles(payload.roles),
    },
  });
}
