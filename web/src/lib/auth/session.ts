import crypto from "node:crypto";

import { APP_SESSION_TTL_SECONDS } from "@/lib/auth/constants";

type SessionPayload = {
  userId: string;
  phone: string;
  displayName?: string | null;
  roles: string[];
  expiresAt: number;
};

function secureCompare(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function sign(payloadB64: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createAppSessionToken(input: {
  userId: string;
  phone: string;
  displayName?: string | null;
  roles: string[];
  secret: string;
}) {
  const payload: SessionPayload = {
    userId: input.userId,
    phone: input.phone,
    displayName: input.displayName ?? null,
    roles: input.roles,
    expiresAt: Date.now() + APP_SESSION_TTL_SECONDS * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(payloadB64, input.secret);
  return `${payloadB64}.${signature}`;
}

export function parseAppSessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, providedSignature] = parts;
  const expectedSignature = sign(payloadB64, secret);

  if (!secureCompare(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.phone !== "string" ||
      (payload.displayName !== undefined &&
        payload.displayName !== null &&
        typeof payload.displayName !== "string") ||
      !Array.isArray(payload.roles) ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
