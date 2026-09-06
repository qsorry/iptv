"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

/** تبويبات بسيطة متجاوبة. المحتوى يُمرَّر من الخادم كـ children لكل تبويب. */
export function Tabs({ items, initial }: { items: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? items[0]?.key);

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {items.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition",
              active === t.key
                ? "border-[var(--brand)] font-medium text-[var(--brand)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
