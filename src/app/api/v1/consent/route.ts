import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStorefrontStore } from "@/core/tenancy/server";
import { ensureVisitorKey } from "@/core/tenancy/visitor-cookie";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, recordConsent, serializeConsent } from "@/modules/tracking";

const bodySchema = z.object({ analytics: z.boolean(), marketing: z.boolean() });

/** POST /api/v1/consent — يخزّن اختيار الزائر بختم زمني ويضبط الكوكي الذي يقرأه المحرك. */
export async function POST(request: NextRequest) {
  const store = await getStorefrontStore();
  if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const visitorKey = await ensureVisitorKey();
  const consent = parsed.data;
  await recordConsent({
    storeId: store.id,
    visitorKey,
    consent,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  const response = NextResponse.json({ ok: true, consent });
  // ليس httpOnly: المتصفح نفسه يقرأه ليقرر تحميل البكسلات من عدمه.
  response.cookies.set(CONSENT_COOKIE, serializeConsent(consent), { httpOnly: false, sameSite: "lax", path: "/", maxAge: CONSENT_MAX_AGE });
  return response;
}
