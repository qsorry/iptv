"use client";

import { useState } from "react";

/** معرض صور المنتج: صورة رئيسية كبيرة + مصغّرات قابلة للنقر. */
export function ProductGallery({ images, alt }: { images: { url: string; altText?: string | null }[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-black/5 text-[var(--muted)]">
        لا صورة
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.altText ?? alt} className="aspect-square w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-[calc(var(--radius)*0.7)] border-2 transition ${
                i === active ? "border-[var(--brand)]" : "border-[var(--border)] opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
