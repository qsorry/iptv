import type { EventConsent } from "../domain/events";
import { PLATFORM_DEFS, type Platform } from "../domain/platforms";

/** كوكي الموافقة يقرأه المتصفح (لتقرير تحميل البكسلات) والخادم معاً؛ لذا ليس httpOnly. */
export const CONSENT_COOKIE = "sq_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export const DENIED: EventConsent = { analytics: false, marketing: false };

/** قيمة الكوكي: "a1m1" / "a1m0" / "a0m0" — قصيرة ومقروءة من الطرفين. */
export function serializeConsent(consent: EventConsent): string {
  return `a${consent.analytics ? 1 : 0}m${consent.marketing ? 1 : 0}`;
}

export function parseConsent(raw: string | null | undefined): EventConsent | null {
  const m = /^a([01])m([01])$/.exec((raw ?? "").trim());
  if (!m) return null;
  return { analytics: m[1] === "1", marketing: m[2] === "1" };
}

/** لا موافقة مخزّنة = رفض. البكسلات لا تعمل قبل موافقة صريحة (PDPL). */
export function consentOrDenied(raw: string | null | undefined): EventConsent {
  return parseConsent(raw) ?? DENIED;
}

/** نقطة واحدة تقرر ما يُرسل وما يُحجب. لا تُترك للمتصفح. */
export function allowsPlatform(consent: EventConsent, platform: Platform): boolean {
  return PLATFORM_DEFS[platform].purpose === "marketing" ? consent.marketing : consent.analytics;
}

/** أي إرسال على الإطلاق ممنوع بلا موافقة واحدة على الأقل. */
export function allowsAnything(consent: EventConsent): boolean {
  return consent.analytics || consent.marketing;
}

/** Google Consent Mode v2 — الحالة الافتراضية denied ثم تُحدَّث بالموافقة. */
export function consentModeState(consent: EventConsent) {
  return {
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    analytics_storage: consent.analytics ? "granted" : "denied",
  } as const;
}
