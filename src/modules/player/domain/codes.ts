import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** بلا أحرف متشابهة (0/O، 1/I) لأنها تُكتب بجهاز التحكم أو تُقرأ من الشاشة. 32 حرفاً فالتوزيع متساوٍ. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

/** حروف الكود فقط بأحرف كبيرة (يقبل المسافات والشرطات والحروف الصغيرة من المستخدم). */
function compact(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const ACTIVATION_CODE_PATTERN = /^SN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function generateActivationCode(): string {
  const c = randomChars(8);
  return `SN-${c.slice(0, 4)}-${c.slice(4)}`;
}

/** «sn 8h3k92pl» → «SN-8H3K-92PL»، أو null إن لم تكن الصيغة صحيحة. */
export function normalizeActivationCode(input: string): string | null {
  let c = compact(input);
  if (c.startsWith("SN")) c = c.slice(2);
  if (c.length !== 8) return null;
  return `SN-${c.slice(0, 4)}-${c.slice(4)}`;
}

export function generatePairingCode(): string {
  const c = randomChars(8);
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function normalizePairingCode(input: string): string | null {
  const c = compact(input);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
}

/** رمز الاستطلاع يبقى في التلفاز فقط؛ القاعدة تحفظ بصمته. */
export function generatePollToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * يقبل ما يلصقه المدير («host:8080/player_api.php?...» أو رابط m3u) ويعيد الأصل فقط: http://host:8080
 * يرمي خطأ إن لم يكن http/https.
 */
export function normalizeServerUrl(input: string): string {
  const raw = input.trim();
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  if (!url.hostname) throw new Error("host");
  return url.origin;
}

/** «394, 512 ٣٩٤» → ["394", "512"] بعد التطبيع وحذف المكرر. */
export function parsePrefixes(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[\s,،;]+/);
  const out = new Set<string>();
  for (const p of parts) {
    const v = toLatinDigits(p).trim().toLowerCase();
    if (v) out.add(v);
  }
  return [...out];
}

/** المستخدم قد يكتب بأرقام عربية مشرقية من لوحة مفاتيح الجوال. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export const PREFIX_PATTERN = /^[a-z0-9._-]{2,32}$/;
