import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE, OTP_STATE_COOKIE } from "@/lib/auth/constants";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
  cookieStore.delete(OTP_STATE_COOKIE);

  return NextResponse.json({
    success: true,
    message: "Deconnexion effectuee.",
  });
}
