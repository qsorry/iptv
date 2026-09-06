import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "@/lib/env";

/** مفتاح AES-256 مشتق من BETTER_AUTH_SECRET؛ لا يُخزَّن مفتاح مستقل. */
const key = scryptSync(env.BETTER_AUTH_SECRET, "subscription-providers", 32);

/** تشفير سر (مفتاح API مثلاً) قبل حفظه في القاعدة. الناتج: iv.tag.cipher بـ base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** يُظهر آخر 4 أحرف فقط للعرض في الواجهة. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
