"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatMoney, toMinor } from "@/core/money";
import { Button } from "@/components/ui/button";

/** زر الإضافة مع حالة انتظار (سبينر) أثناء التوجّه إلى السلة. */
function AddButton({ digital, className }: { digital: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className ?? "w-full py-3 text-base sm:w-auto sm:px-8"}>
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          جارٍ الإضافة…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0" />
          </svg>
          {digital ? "اشترِ الآن" : "أضف إلى السلة"}
        </>
      )}
    </Button>
  );
}

export interface BuyVariant {
  id: string;
  name: string;
  price: string;
  compareAtPrice?: string | null;
}

/** لوحة الشراء التفاعلية: اختيار الخيار، السعر مع الخصم، الكمية، والإضافة للسلة. */
export function BuyBox({
  variants,
  currency,
  action,
  digital,
}: {
  variants: BuyVariant[];
  currency: string;
  action: (formData: FormData) => void;
  digital: boolean;
}) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  const price = variant ? toMinor(variant.price) : 0;
  const compareAt = variant?.compareAtPrice ? toMinor(variant.compareAtPrice) : 0;
  const hasDiscount = compareAt > price && price > 0;
  const discountPct = hasDiscount ? Math.round((1 - price / compareAt) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* السعر */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl font-bold text-[var(--brand)]" dir="ltr">
          {formatMoney(price, currency)}
        </span>
        {hasDiscount && (
          <>
            <span className="text-lg text-[var(--muted)] line-through" dir="ltr">
              {formatMoney(compareAt, currency)}
            </span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600" dir="ltr">
              خصم {discountPct}%
            </span>
          </>
        )}
      </div>

      {/* اختيار الخيار كأزرار */}
      {variants.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium">اختر الباقة</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const selected = v.id === variantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-[var(--radius)] border-2 px-4 py-2 text-sm transition ${
                    selected
                      ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] font-semibold text-[var(--brand)]"
                      : "border-[var(--border)] hover:border-[var(--brand)]"
                  }`}
                >
                  <span className="block">{v.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]" dir="ltr">
                    {formatMoney(toMinor(v.price), currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* الكمية */}
      <div>
        <label className="mb-2 block text-sm font-medium">الكمية</label>
        <div className="inline-flex items-center rounded-[var(--radius)] border border-[var(--border)]">
          <button
            type="button"
            aria-label="إنقاص"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-10 w-10 place-items-center text-lg hover:bg-black/5"
          >
            −
          </button>
          <span className="w-12 text-center font-medium" dir="ltr">
            {qty}
          </span>
          <button
            type="button"
            aria-label="زيادة"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="grid h-10 w-10 place-items-center text-lg hover:bg-black/5"
          >
            +
          </button>
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="variantId" value={variantId} />
        <input type="hidden" name="quantity" value={qty} />
        <AddButton digital={digital} />

        {/* شريط شراء ثابت أسفل الشاشة على الجوال — يتبع التمرير */}
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <div className="shrink-0 leading-tight">
              <div className="text-[11px] text-[var(--muted)]">الإجمالي</div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-[var(--brand)]" dir="ltr">{formatMoney(price * qty, currency)}</span>
                {hasDiscount && (
                  <span className="text-xs text-[var(--muted)] line-through" dir="ltr">{formatMoney(compareAt * qty, currency)}</span>
                )}
              </div>
            </div>
            <AddButton digital={digital} className="flex-1 justify-center py-3 text-base" />
          </div>
        </div>
      </form>
    </div>
  );
}
