"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * نافذة حوارية مبنية على <dialog> الأصلي: تركيز محبوس، إغلاق بـ Esc وبالنقر خارجها.
 * تُستخدم للتفاعل فقط؛ المحتوى المهم لمحركات البحث لا يوضع داخلها.
 */
export function Modal({ open, onClose, title, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "w-[calc(100%-2rem)] max-w-lg rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-0 text-ink shadow-lg backdrop:bg-black/40",
        className,
      )}
    >
      <div className="p-5 sm:p-6">
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </dialog>
  );
}
