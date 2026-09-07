"use client";

export const CONSENT_COOKIE = "sq_consent";
export const CONSENT_CHANGED = "sq:consent";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

export function readConsentCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1];
  const m = /^a([01])m([01])$/.exec(raw ?? "");
  return m ? { analytics: m[1] === "1", marketing: m[2] === "1" } : null;
}

/** يحفظ الاختيار على الخادم (بختم زمني) ثم يُعلم بقية الصفحة. */
export async function saveConsent(consent: ConsentState): Promise<void> {
  await fetch("/api/v1/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(consent),
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGED, { detail: consent }));
}
