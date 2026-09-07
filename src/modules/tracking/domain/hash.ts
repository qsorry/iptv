import { createHash, randomUUID } from "node:crypto";

/** SHA-256 hex. الهاش يتم على السيرفر فقط؛ لا يغادر البريد أو الجوال نصاً صريحاً. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** البريد: lowercase + trim قبل الهاش. */
export function hashEmail(email: string | null | undefined): string | null {
  const v = (email ?? "").trim().toLowerCase();
  return v.includes("@") ? sha256(v) : null;
}

/** الجوال: E.164 بدون + ولا مسافات. الأرقام السعودية المحلية تُحوَّل إلى 966. */
export function hashPhone(phone: string | null | undefined, defaultCountryCode = "966"): string | null {
  let v = (phone ?? "").replace(/[^\d+]/g, "");
  if (!v) return null;
  if (v.startsWith("+")) v = v.slice(1);
  else if (v.startsWith("00")) v = v.slice(2);
  else if (v.startsWith("0")) v = defaultCountryCode + v.slice(1);
  else if (v.length <= 9) v = defaultCountryCode + v;
  return /^\d{8,15}$/.test(v) ? sha256(v) : null;
}

export function newEventId(): string {
  return randomUUID();
}

/**
 * معرّف حدث ثابت مشتق من مفتاح — يجعل نسخة المتصفح ونسخة السيرفر
 * تحملان نفس event_id حتى لو وُلّدتا في طلبين مختلفين (مثال: purchase لطلب).
 */
export function deterministicEventId(key: string): string {
  const h = sha256(key);
  const b = h.slice(0, 32).split("");
  // نضبط رقم النسخة (4) ومتغيّر RFC 4122 حتى يقبله المستقبِل كـ UUID صالح.
  b[12] = "4";
  b[16] = "89ab"[parseInt(b[16], 16) % 4];
  const s = b.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
