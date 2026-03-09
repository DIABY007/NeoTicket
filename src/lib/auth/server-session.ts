import { cookies } from "next/headers";

import { APP_SESSION_COOKIE } from "@/lib/auth/constants";
import { parseAppSessionToken } from "@/lib/auth/session";

export async function getSessionFromRequestCookies() {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    throw new Error("OTP_SIGNING_SECRET is missing");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = parseAppSessionToken(token, secret);
  if (!payload) {
    cookieStore.delete(APP_SESSION_COOKIE);
    return null;
  }

  return payload;
}
