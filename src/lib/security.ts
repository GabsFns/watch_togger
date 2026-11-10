import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function secureCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sanitizeName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function sanitizeMessage(raw: string): string {
  return (raw ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function isValidAccessCode(code: string): boolean {
  if (!code) return false;
  const expected = process.env.ROOM_ACCESS_CODE ?? "";
  if (!expected) return false;
  return secureCompare(code.trim(), expected);
}
