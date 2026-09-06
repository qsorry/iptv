"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** سطر ثانٍ اختياري (سعر، وصف مختصر…). */
  description?: string;
  disabled?: boolean;
}

type Props = {
  /** اسم الحقل داخل النموذج؛ يُرسل عبر input مخفي. */
  name?: string;
  options: SelectOption[];
  /** قيمة غير مُدارة (تُستخدم إن لم تُمرَّر value). */
  defaultValue?: string;
  /** قيمة مُدارة. */
  value?: string;
  onChange?: (value: string) => void;
  /** عنوان الورقة السفلية. يُفضَّل تمرير نفس نص التسمية. */
  title?: string;
  placeholder?: string;
  /** عند true: لا يُسمح بترك الحقل فارغاً (يُختار أول خيار افتراضياً). */
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** اتجاه نص السطر الثاني (الوصف)، مثلاً ltr للأسعار. */
  dir?: "rtl" | "ltr";
};

const CLOSE_MS = 180;

/**
 * قائمة اختيار موحّدة للمنصة: بدل <select> الأصلي، زر يفتح ورقة سفلية (Bottom Sheet)
 * تنزلق من أسفل الشاشة وتعرض الخيارات كقائمة راديو كبيرة الأهداف.
 * القاعدة عامة: كل اختيار خيار/تصنيف/باقة في المتجر ولوحة الإدارة يمرّ من هنا.
 * التصميم يعتمد الرموز (--surface, --border, --brand, --radius, --safe-bottom) ويعمل في الوضع الداكن تلقائياً.
 */
export function Select({
  name,
  options,
  defaultValue,
  value,
  onChange,
  title,
  placeholder = "اختر…",
  required,
  disabled,
  id,
  className,
  dir,
}: Props) {
  const controlled = value !== undefined;
  const initial = defaultValue ?? (required ? options.find((o) => !o.disabled)?.value ?? "" : "");
  const [inner, setInner] = useState(initial);
  const current = controlled ? value : inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const titleId = `${autoId}-title`;

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
      triggerRef.current?.focus();
    }, CLOSE_MS);
  }, [open, closing]);

  // قفل تمرير الصفحة + الإغلاق بـ Escape + تركيز الخيار الحالي عند الفتح.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    const focusTarget =
      listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      listRef.current?.querySelector<HTMLButtonElement>("[role=radio]:not(:disabled)");
    focusTarget?.focus({ preventScroll: true });
    focusTarget?.scrollIntoView({ block: "nearest" });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function pick(v: string) {
    if (!controlled) setInner(v);
    onChange?.(v);
    close();
  }

  // تنقّل بالأسهم بين الخيارات داخل القائمة.
  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]:not(:disabled)") ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  const sheet =
    open && mounted
      ? createPortal(
          <div className={cn("fixed inset-0 z-50 flex items-end justify-center", closing && "sheet-closing")} role="presentation">
            <div
              className="sheet-backdrop absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={close}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="sheet-panel relative flex w-full max-h-[85dvh] flex-col rounded-t-[calc(var(--radius)+0.5rem)] border border-b-0 border-[var(--border)] bg-[var(--surface)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] sm:max-w-md sm:rounded-b-[calc(var(--radius)+0.5rem)] sm:border-b sm:mb-6"
              style={{ paddingBottom: "var(--safe-bottom)" }}
            >
              <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
                <span className="h-1.5 w-10 rounded-full bg-[var(--border)]" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 sm:pt-4">
                <h2 id={titleId} className="text-base font-semibold">
                  {title ?? placeholder}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="إغلاق"
                  className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div
                ref={listRef}
                role="radiogroup"
                aria-labelledby={titleId}
                onKeyDown={onListKey}
                className="overflow-y-auto overscroll-contain px-2 pb-3"
              >
                {options.map((o) => {
                  const on = o.value === current;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={o.disabled}
                      onClick={() => pick(o.value)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-3 text-start text-base transition",
                        "hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
                        "disabled:opacity-40",
                        on && "bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] font-semibold text-[var(--brand)]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                          on ? "border-[var(--brand)]" : "border-[var(--border)]",
                        )}
                      >
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.description && (
                          <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]" dir={dir}>
                            {o.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-start text-base",
          "outline-none focus-visible:border-[var(--brand)] focus-visible:ring-1 focus-visible:ring-[var(--brand)] disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-[var(--muted)]")}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {sheet}
    </>
  );
}
