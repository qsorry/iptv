"use client";

import { useState } from "react";

/** رابط جاهز للنسخ بضغطة. يُستخدم لخلاصة المنتجات وخريطة الموقع في صفحة التكاملات. */
export function CopyField({ value, label, hint }: { value: string; label: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // متصفح بلا صلاحية حافظة: الحقل نفسه يبقى قابلاً للتحديد يدوياً.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-card border border-border p-3">
      <div className="text-sm font-medium">{label}</div>
      {hint && <p className="mt-0.5 text-xs text-ink-secondary">{hint}</p>}
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={value}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-button border border-border px-3 py-2 text-sm hover:bg-black/5"
        >
          {copied ? "نُسخ ✓" : "نسخ"}
        </button>
      </div>
    </div>
  );
}
