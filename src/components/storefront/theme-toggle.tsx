"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { THEME_MODE_KEY, THEME_ROOT_ID, isThemeMode, type ThemeMode } from "./theme-mode";

/** أيقونات Material Design Icons (weather-sunny, weather-night, monitor). */
const ICONS: Record<ThemeMode, string> = {
  light:
    "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  dark:
    "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z",
  system:
    "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z",
};

const OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "light", label: "فاتح", hint: "الوضع الفاتح دائماً" },
  { value: "dark", label: "داكن", hint: "الوضع الداكن دائماً" },
  { value: "system", label: "تلقائي", hint: "حسب إعدادات الجهاز" },
];

function Icon({ mode, className }: { mode: ThemeMode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 fill-current", className)} aria-hidden="true">
      <path d={ICONS[mode]} />
    </svg>
  );
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_MODE_KEY);
    if (isThemeMode(v)) return v;
  } catch {}
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_MODE_KEY}=(light|dark|system)`));
  return m && isThemeMode(m[1]) ? m[1] : "system";
}

function applyMode(mode: ThemeMode) {
  const targets = [document.documentElement, document.getElementById(THEME_ROOT_ID)];
  for (const el of targets) {
    if (!el) continue;
    if (mode === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", mode);
  }
}

function persistMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {}
  document.cookie = `${THEME_MODE_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * مبدّل وضع العرض للزائر (فاتح / داكن / تلقائي). زر واحد في الشريط العلوي يفتح قائمة صغيرة.
 * الاختيار يُحفظ في localStorage وكوكي فيبقى عبر الصفحات والزيارات.
 */
export function ThemeToggle({ initialMode = "system" }: { initialMode?: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // مزامنة الحالة مع القيمة المحفوظة (قد تختلف عن الكوكي إن حُفظت في localStorage فقط).
  useEffect(() => {
    setMode(readStoredMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_MODE_KEY && isThemeMode(e.newValue)) {
        setMode(e.newValue);
        applyMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: ThemeMode) {
    setMode(next);
    applyMode(next);
    persistMode(next);
    setOpen(false);
  }

  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[2];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`وضع العرض: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="touch-target grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"
      >
        <Icon mode={mode} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="وضع العرض"
          className="absolute top-full z-30 mt-2 min-w-44 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-1 text-sm shadow-lg"
          style={{ insetInlineEnd: 0 }}
        >
          {OPTIONS.map((o) => {
            const active = o.value === mode;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[calc(var(--radius)-0.25rem)] px-3 py-2 text-start transition",
                  active ? "bg-[var(--brand-container)] text-[var(--brand-container-fg)]" : "hover:bg-[var(--surface-2)]",
                )}
              >
                <Icon mode={o.value} className={active ? "" : "text-[var(--muted)]"} />
                <span className="flex-1">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-xs text-[var(--muted)]">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
