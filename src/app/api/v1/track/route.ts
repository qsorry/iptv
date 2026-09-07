import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStorefrontStore } from "@/core/tenancy/server";
import { ensureVisitorKey } from "@/core/tenancy/visitor-cookie";
import { captureVisit } from "@/modules/attribution";
import { CONSENT_COOKIE, consentOrDenied, isUnifiedEvent, trackEvent } from "@/modules/tracking";

const bodySchema = z.object({
  event: z.string(),
  eventId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  referrer: z.string().optional(),
  data: z
    .object({
      currency: z.string().length(3).optional(),
      value: z.number().nonnegative().optional(),
      searchTerm: z.string().max(200).optional(),
      items: z
        .array(z.object({ id: z.string().max(120), name: z.string().max(200).optional(), qty: z.number().int().positive(), price: z.number().nonnegative() }))
        .max(50)
        .optional(),
    })
    .optional(),
});

/** قيمة الشراء لا تُصدَّق من المتصفح؛ purchase يُنتج على السيرفر من الطلب نفسه. */
const CLIENT_FORBIDDEN = new Set(["purchase"]);

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : request.headers.get("x-real-ip");
}

/**
 * POST /api/v1/track — نقطة الدخول الوحيدة لأحداث المتصفح.
 * تردّ فوراً: المحرك يكتب في الطابور وعامل منفصل يرسل للمنصات.
 */
export async function POST(request: NextRequest) {
  const store = await getStorefrontStore();
  if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { event, eventId, url, referrer, data } = parsed.data;
  if (!isUnifiedEvent(event) || CLIENT_FORBIDDEN.has(event)) {
    return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  }

  const visitorKey = await ensureVisitorKey();
  const userAgent = request.headers.get("user-agent");
  const sourceUrl = url ?? request.headers.get("referer");

  // الإسناد أولاً: أحداث لاحقة تُثرى بالـ click ids المخزّنة على الزائر.
  if (sourceUrl) {
    await captureVisit({ storeId: store.id, visitorKey, url: sourceUrl, referrer: referrer ?? null, userAgent });
  }

  const consent = consentOrDenied(request.cookies.get(CONSENT_COOKIE)?.value);
  const result = await trackEvent({
    storeId: store.id,
    eventName: event,
    eventId,
    consent,
    visitorKey,
    eventSourceUrl: sourceUrl,
    user: { clientIp: clientIp(request), userAgent, externalId: visitorKey },
    data: { currency: store.currencyCode, ...(data ?? {}) },
  });

  return NextResponse.json(result);
}
