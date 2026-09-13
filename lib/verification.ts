import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const VERIFIED_TOKEN_TTL_MS = 30 * 60 * 1000;

export function generateVerificationCode() {
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

export function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidCodeFormat(code: unknown): code is string {
  return typeof code === "string" && new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

export function safeCompare(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
