import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/** معرّف الزائر للإسناد. httpOnly: المتصفح لا يحتاج قراءته، السيرفر هو من يربط الطلب بمصدره. */
export const VISITOR_COOKIE = "sq_vid";
const MAX_AGE = 60 * 60 * 24 * 365;

export async function readVisitorKey(): Promise<string | undefined> {
  return (await cookies()).get(VISITOR_COOKIE)?.value;
}

/** يقرأ المعرّف أو ينشئه ويكتبه في الكوكي. يُستدعى من Route Handler أو Server Action فقط. */
export async function ensureVisitorKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const key = randomUUID();
  jar.set(VISITOR_COOKIE, key, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return key;
}
