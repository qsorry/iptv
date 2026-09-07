import Link from "next/link";

/** عنوان قسم مع رابط "عرض الكل" اختياري. عنصر h2 دائماً (h1 واحد للصفحة في Hero). */
export function SectionHeading({ title, href, hrefLabel = "عرض الكل" }: { title: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
      <h2 className="text-lg font-bold sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="touch-target inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          {hrefLabel}
          <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
