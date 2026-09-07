import Link from "next/link";

export interface Crumb {
  name: string;
  href?: string;
}

/** بيانات BreadcrumbList المهيكلة لنفس المسار (تُرسم خادمياً). */
export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(c.href ? { item: c.href } : {}) })),
  };
}

/** مسار تنقّل بروابط حقيقية (قابل للزحف). آخر عنصر هو الصفحة الحالية بلا رابط. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسار التنقّل" className="mb-4 text-xs text-ink-secondary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(items)) }} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-ink">{c.name}</Link>
              ) : (
                <span className="text-ink" aria-current={last ? "page" : undefined}>{c.name}</span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
