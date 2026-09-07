export interface Benefit {
  title: string;
  sub: string;
  icon: string;
}

export const DEFAULT_BENEFITS: Benefit[] = [
  { icon: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z", title: "تسليم فوري", sub: "استلم طلبك مباشرة بعد الدفع" },
  { icon: "M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z", title: "دفع آمن", sub: "بوابات دفع موثوقة ومشفّرة" },
  { icon: "M20 6 9 17l-5-5", title: "جودة مضمونة", sub: "منتجات أصلية وخدمة موثوقة" },
  { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z", title: "دعم متواصل", sub: "فريقنا جاهز لمساعدتك دائماً" },
];

/** شريط المزايا: 4 عناصر بأيقونات. على الجوال عمودان. */
export function Benefits({ items = DEFAULT_BENEFITS }: { items?: Benefit[] }) {
  return (
    <section aria-label="مزايا المتجر">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((f) => (
          <li key={f.title} className="flex items-start gap-3 rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-card sm:p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-container text-brand-container-fg">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={f.icon} />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{f.title}</div>
              <div className="mt-0.5 text-xs text-ink-secondary">{f.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
