const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, "");

  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  if (/^\d{8}$/.test(trimmed)) {
    return `+226${trimmed}`;
  }

  return trimmed;
}

export function isE164Phone(phone: string): boolean {
  return E164_REGEX.test(phone);
}
