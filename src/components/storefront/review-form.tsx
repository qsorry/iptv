"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** نموذج تقييم لا يظهر مباشرة: يُفتح بزر، ويحوي منتقي نجوم تفاعلياً + تحقق الشراء بالإيميل. */
export function ReviewForm({ action }: { action: (formData: FormData) => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        اكتب تقييمك
      </Button>
    );
  }

  const shown = hover || rating;

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">شاركنا تقييمك</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--muted)] hover:underline">
          إلغاء
        </button>
      </div>

      <input type="hidden" name="rating" value={rating || 5} />
      <div>
        <span className="mb-1 block text-sm text-[var(--muted)]">تقييمك</span>
        <div className="flex gap-1" dir="ltr" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} نجوم`}
              className={`text-2xl leading-none transition ${n <= shown ? "text-yellow-400" : "text-[var(--border)]"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        الاسم (اختياري)
        <input
          name="authorName"
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
        />
      </label>

      <label className="block text-sm">
        البريد الإلكتروني (لتوثيق الشراء — اختياري)
        <input
          name="email"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">إن كنت اشتريت المنتج بهذا البريد، سيظهر تقييمك بوسم «شراء موثّق».</span>
      </label>

      <label className="block text-sm">
        تعليقك
        <textarea
          name="body"
          rows={3}
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          إرسال التقييم
        </Button>
        <span className="text-xs text-[var(--muted)]">يُنشر بعد مراجعة المتجر.</span>
      </div>
    </form>
  );
}
