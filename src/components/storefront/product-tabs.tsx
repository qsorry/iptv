"use client";

import { useState } from "react";

/** تبويبات صفحة المنتج: الوصف / التقييمات. تستقبل المحتوى المُجهَّز من الخادم. */
export function ProductTabs({
  description,
  reviews,
  reviewCount,
}: {
  description: React.ReactNode;
  reviews: React.ReactNode;
  reviewCount: number;
}) {
  const hasDesc = Boolean(description);
  const [tab, setTab] = useState<"desc" | "reviews">(hasDesc ? "desc" : "reviews");

  const tabs: { key: "desc" | "reviews"; label: string; show: boolean }[] = [
    { key: "desc", label: "الوصف", show: hasDesc },
    { key: "reviews", label: `التقييمات${reviewCount ? ` (${reviewCount})` : ""}`, show: true },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-[var(--brand)] text-[var(--brand)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>
      <div className="pt-5">
        <div hidden={tab !== "desc"}>{description}</div>
        <div hidden={tab !== "reviews"}>{reviews}</div>
      </div>
    </div>
  );
}
