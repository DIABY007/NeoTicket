import crypto from "node:crypto";

import { OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from "@/lib/auth/constants";

type OtpPayload = {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attemptsUsed: number;
};

type VerificationResult =
  | { ok: true; payload: OtpPayload }
  | {
      ok: false;
      reason: "missing_secret" | "invalid_token" | "expired" | "invalid_code" | "locked";
      payload?: OtpPayload;
    };

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signPayload(payloadB64: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function secureCompare(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function createOtpStateToken(phone: string, code: string, secret: string) {
  const payload: OtpPayload = {
    phone,
    codeHash: sha256Hex(`${code}:${secret}`),
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    attemptsUsed: 0,
  };

  return encodeOtpPayload(payload, secret);
}

export function encodeOtpPayload(payload: OtpPayload, secret: string) {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function parseOtpStateToken(token: string, secret: string): OtpPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, providedSignature] = parts;
  const expectedSignature = signPayload(payloadB64, secret);

  if (!secureCompare(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as OtpPayload;

    if (
      typeof parsed.phone !== "string" ||
      typeof parsed.codeHash !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.attemptsUsed !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function verifyOtpStateToken(token: string, code: string, secret: string): VerificationResult {
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  const payload = parseOtpStateToken(token, secret);
  if (!payload) {
    return { ok: false, reason: "invalid_token" };
  }

  if (Date.now() > payload.expiresAt) {
    return { ok: false, reason: "expired", payload };
  }

  if (payload.attemptsUsed >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "locked", payload };
  }

  const expectedHash = sha256Hex(`${code}:${secret}`);
  if (!secureCompare(payload.codeHash, expectedHash)) {
    const updatedAttempts = payload.attemptsUsed + 1;
    return {
      ok: false,
      reason: updatedAttempts >= OTP_MAX_ATTEMPTS ? "locked" : "invalid_code",
      payload: {
        ...payload,
        attemptsUsed: updatedAttempts,
      },
    };
  }

  return { ok: true, payload };
}
