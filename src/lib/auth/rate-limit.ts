import {
  OTP_MAX_RESENDS_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/constants";

type PhoneState = {
  sentAt: number[];
};

const phoneOtpState = new Map<string, PhoneState>();

function nowMs() {
  return Date.now();
}

function oneHourAgoMs() {
  return nowMs() - 60 * 60 * 1000;
}

export function checkSendOtpRateLimit(phone: string) {
  const state = phoneOtpState.get(phone) ?? { sentAt: [] };
  const recent = state.sentAt.filter((value) => value >= oneHourAgoMs());

  if (recent.length >= OTP_MAX_RESENDS_PER_HOUR) {
    const retryAt = recent[0] + 60 * 60 * 1000;
    return {
      allowed: false as const,
      reason: "hour_limit" as const,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - nowMs()) / 1000)),
    };
  }

  const lastSentAt = recent[recent.length - 1];
  if (lastSentAt) {
    const elapsed = nowMs() - lastSentAt;
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsed < cooldownMs) {
      return {
        allowed: false as const,
        reason: "cooldown" as const,
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000)),
      };
    }
  }

  return { allowed: true as const };
}

export function registerOtpSend(phone: string) {
  const state = phoneOtpState.get(phone) ?? { sentAt: [] };
  const recent = state.sentAt.filter((value) => value >= oneHourAgoMs());
  recent.push(nowMs());
  phoneOtpState.set(phone, { sentAt: recent });
}
