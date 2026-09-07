import { db } from "@/infrastructure/database/client";
import { consentRecords } from "@/infrastructure/database/schema";
import type { EventConsent } from "../domain/events";

/** تُخزَّن الموافقة بختم زمني. كل تغيير صف جديد، لا تحديث. */
export async function recordConsent(input: {
  storeId: string;
  visitorKey: string;
  consent: EventConsent;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await db.insert(consentRecords).values({
    storeId: input.storeId,
    visitorKey: input.visitorKey,
    analytics: input.consent.analytics,
    marketing: input.consent.marketing,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}
