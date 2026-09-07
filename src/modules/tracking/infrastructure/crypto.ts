import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * تشفير توكنات التكامل قبل تخزينها. المفتاح خارج قاعدة البيانات
 * (`INTEGRATIONS_SECRET_KEY`، أو `BETTER_AUTH_SECRET` احتياطاً).
 */
function key(): Buffer {
  const raw = process.env.INTEGRATIONS_SECRET_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!raw) throw new Error("INTEGRATIONS_SECRET_KEY غير مضبوط");
  return createHash("sha256").update(raw, "utf8").digest();
}

const PREFIX = "v1";

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64"), enc.toString("base64"), cipher.getAuthTag().toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, data, tag] = stored.split(":");
  if (version !== PREFIX || !iv || !data || !tag) throw new Error("صيغة سر غير صالحة");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** لا يُعاد السر للواجهة إلا مقنّعاً: آخر ٤ خانات فقط. */
export function maskSecret(plain: string): string {
  const v = plain.trim();
  if (!v) return "";
  return v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
}
