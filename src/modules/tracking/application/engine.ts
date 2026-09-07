import { eq, and } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { trackingEvents, visitors } from "@/infrastructure/database/schema";
import { allowsAnything, DENIED } from "./consent";
import { hashEmail, hashPhone, newEventId } from "../domain/hash";
import type { EventConsent, EventData, UnifiedEvent, UnifiedEventName } from "../domain/events";

export interface TrackEventInput {
  storeId: string;
  eventName: UnifiedEventName;
  /** يُمرَّر من المتصفح ليتطابق مع نسخة البكسل؛ وإلا يولّده المحرك. */
  eventId?: string;
  /** مفتاح منع تكرار ثانٍ على مستوى السيرفر (مثال: `purchase:<order_id>`). */
  dedupeKey?: string | null;
  consent: EventConsent;
  visitorKey?: string | null;
  eventSourceUrl?: string | null;
  eventTime?: Date;
  user?: {
    email?: string | null;
    phone?: string | null;
    externalId?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
    fbc?: string | null;
    fbp?: string | null;
  };
  data?: EventData;
}

export interface TrackEventResult {
  eventId: string;
  /** false = حُجب (بلا موافقة) أو مكرّر؛ لم يُكتب شيء في الطابور. */
  queued: boolean;
  reason?: "no_consent" | "duplicate";
}

/** fbc بصيغة Meta: fb.1.<millis>.<fbclid> */
function toFbc(fbclid: string | null | undefined, at: Date): string | null {
  return fbclid ? `fb.1.${at.getTime()}.${fbclid}` : null;
}

/**
 * محرك الأحداث المركزي: يستقبل الفعل مرة واحدة، يفحص الموافقة، يُثري،
 * ثم يكتب في الطابور ويردّ فوراً. لا انتظار لرد أي منصة داخل مسار الطلب.
 */
export async function trackEvent(input: TrackEventInput, executor: DbExecutor = db): Promise<TrackEventResult> {
  const eventId = input.eventId ?? newEventId();
  const consent = input.consent ?? DENIED;
  const at = input.eventTime ?? new Date();

  if (!allowsAnything(consent)) return { eventId, queued: false, reason: "no_consent" };

  const touch = input.visitorKey ? await lastTouch(executor, input.storeId, input.visitorKey) : null;

  const event: UnifiedEvent = {
    eventId,
    eventName: input.eventName,
    eventTime: Math.floor(at.getTime() / 1000),
    eventSourceUrl: input.eventSourceUrl ?? null,
    consent,
    user: {
      emailSha256: hashEmail(input.user?.email),
      phoneSha256: hashPhone(input.user?.phone),
      externalId: input.user?.externalId ?? input.visitorKey ?? null,
      clientIp: input.user?.clientIp ?? null,
      userAgent: input.user?.userAgent ?? null,
      clickIds: {
        fbc: input.user?.fbc ?? toFbc(touch?.fbclid, at),
        fbp: input.user?.fbp ?? null,
        ttclid: touch?.ttclid ?? null,
        sccid: touch?.sccid ?? null,
        gclid: touch?.gclid ?? null,
      },
    },
    data: input.data ?? {},
  };

  const [row] = await executor
    .insert(trackingEvents)
    .values({
      storeId: input.storeId,
      eventId,
      eventName: input.eventName,
      dedupeKey: input.dedupeKey ?? null,
      eventTime: at,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [trackingEvents.storeId, trackingEvents.dedupeKey] })
    .returning({ id: trackingEvents.id });

  return row ? { eventId, queued: true } : { eventId, queued: false, reason: "duplicate" };
}

async function lastTouch(executor: DbExecutor, storeId: string, visitorKey: string) {
  const [row] = await executor
    .select({ lastTouch: visitors.lastTouch })
    .from(visitors)
    .where(and(eq(visitors.storeId, storeId), eq(visitors.visitorKey, visitorKey)))
    .limit(1);
  return (row?.lastTouch ?? null) as Record<string, string | null> | null;
}
