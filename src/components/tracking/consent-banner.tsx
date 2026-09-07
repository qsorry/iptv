"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readConsentCookie, saveConsent, type ConsentState } from "./consent-client";

/**
 * لافتة الموافقة (PDPL): خياران حقيقيان — قبول أو رفض. لا زر قبول وحيد.
 * البكسلات لا تُحمَّل قبل اختيار صريح، والاختيار يُخزَّن بختم زمني على الخادم.
 */
export function ConsentBanner({ privacyHref = "/pages/privacy" }: { privacyHref?: string }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVisible(readConsentCookie() === null);
  }, []);

  if (!visible) return null;

  const choose = async (consent: ConsentState) => {
    setBusy(true);
    await saveConsent(consent);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="إعدادات الخصوصية"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] shadow-card sm:inset-x-auto sm:bottom-4 sm:end-4 sm:max-w-sm sm:rounded-card sm:border"
    >
      <p className="text-sm text-ink">
        نستخدم ملفات تعريف الارتباط لقياس أداء المتجر وتحسين تجربة الشراء. لن نشارك أي بيانات مع منصات الإعلان قبل موافقتك.{" "}
        <a href={privacyHref} className="underline">
          سياسة الخصوصية
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" disabled={busy} onClick={() => choose({ analytics: true, marketing: true })} className="flex-1">
          أوافق
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => choose({ analytics: false, marketing: false })} className="flex-1">
          أرفض
        </Button>
      </div>
    </div>
  );
}
