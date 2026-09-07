/**
 * حقول الإسناد. تُلتقط من أول زيارة وتُخزَّن في نسختين:
 * first touch (لا يُكتب فوقها أبداً) و last touch (تُحدَّث مع كل زيارة).
 */
export const UTM_KEYS = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const;
export const CLICK_ID_KEYS = ["gclid", "fbclid", "ttclid", "sccid", "msclkid"] as const;
export const CONTEXT_KEYS = ["referrer", "landingPage", "device"] as const;
export const TOUCH_KEYS = [...UTM_KEYS, ...CLICK_ID_KEYS, ...CONTEXT_KEYS] as const;

export type TouchKey = (typeof TOUCH_KEYS)[number];
export type Touch = Partial<Record<TouchKey, string | null>> & { firstSeenAt?: string };

/** اسم معامل الرابط المقابل لكل حقل. */
const QUERY_PARAM: Record<string, string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
  gclid: "gclid",
  fbclid: "fbclid",
  ttclid: "ttclid",
  sccid: "sccid",
  msclkid: "msclkid",
};

const MAX_LEN = 300;

const clean = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const s = v.trim().slice(0, MAX_LEN);
  return s.length > 0 ? s : null;
};

/** تصنيف الجهاز من User-Agent. ثلاث قيم فقط تكفي للتقارير. */
export function deviceFromUserAgent(ua: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const s = (ua ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return "mobile";
  return "desktop";
}

/** referrer داخلي (نفس المضيف) ليس مصدر إسناد. */
function externalReferrer(referrer: string | null | undefined, currentHost: string | null): string | null {
  const r = clean(referrer);
  if (!r) return null;
  try {
    const host = new URL(r).host.toLowerCase();
    if (currentHost && host === currentHost.toLowerCase()) return null;
    return r;
  } catch {
    return null;
  }
}

/** يبني لمسة إسناد من رابط الوصول والـ referrer والـ User-Agent. */
export function parseTouch(input: { url: string; referrer?: string | null; userAgent?: string | null }): Touch {
  let parsed: URL | null = null;
  try {
    parsed = new URL(input.url);
  } catch {
    parsed = null;
  }
  const params = parsed?.searchParams;
  const touch: Touch = {};
  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    touch[key] = clean(params?.get(QUERY_PARAM[key]));
  }
  touch.referrer = externalReferrer(input.referrer, parsed?.host ?? null);
  touch.landingPage = parsed ? clean(`${parsed.origin}${parsed.pathname}`) : clean(input.url);
  touch.device = deviceFromUserAgent(input.userAgent);
  return touch;
}

/** لمسة بلا أي إشارة مصدر (زيارة مباشرة) لا تستحق أن تُكتب فوق last touch. */
export function hasSource(touch: Touch): boolean {
  return [...UTM_KEYS, ...CLICK_ID_KEYS, "referrer" as const].some((k) => Boolean(touch[k]));
}
