import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { faqJsonLd, packagesJsonLd, hasContent, type LandingContent } from "@/modules/content";

export interface LandingPackage {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
  ratingAvg: number;
  ratingCount: number;
}

/**
 * صفحة هبوط تجارية: بطل ← باقات ← أجهزة ← لماذا نحن ← أسئلة ← صفحات ذات صلة.
 * الترتيب ثابت لأنه ترتيب قرار الشراء، والأقسام الفارغة لا تُرسم.
 * الأسعار من الكتالوج لا من نص الصفحة — مصدر واحد لا يختلف عن صفحة المنتج.
 */
export function LandingPage({
  content,
  packages,
  currency,
  origin,
  title,
}: {
  content: LandingContent;
  packages: LandingPackage[];
  currency: string;
  origin: string;
  title: string;
}) {
  const faq = faqJsonLd(content.faq.items);
  const list = packagesJsonLd(
    packages.map((p) => ({
      name: p.name,
      url: `${origin}/products/${encodeURIComponent(p.slug)}`,
      price: Number(p.price).toFixed(2),
      currency,
      available: true,
    })),
  );

  return (
    <div className="mx-auto max-w-5xl">
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />}
      {list && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }} />}

      <Breadcrumbs items={[{ name: "الرئيسية", href: "/" }, { name: title }]} />

      {hasContent.hero(content) && (
        <section className="py-6 text-center sm:py-10">
          {content.hero.heading && <h1 className="text-2xl font-bold leading-tight sm:text-4xl">{content.hero.heading}</h1>}
          {content.hero.subheading && (
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-secondary sm:text-base">{content.hero.subheading}</p>
          )}
          {content.hero.badges.length > 0 && (
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {content.hero.badges.map((badge) => (
                <li key={badge} className="rounded-full bg-surface-muted px-3 py-1 text-xs text-ink-secondary">
                  {badge}
                </li>
              ))}
            </ul>
          )}
          {content.hero.ctaLabel && content.hero.ctaHref && (
            <Link href={content.hero.ctaHref} className={buttonClasses({ className: "mt-6 px-8 py-3 text-base" })}>
              {content.hero.ctaLabel}
            </Link>
          )}
        </section>
      )}

      {hasContent.packages(content) && packages.length > 0 && (
        <section id="packages" className="scroll-mt-20 py-6">
          {content.packages.heading && <h2 className="mb-1 text-xl font-bold sm:text-2xl">{content.packages.heading}</h2>}
          {content.packages.note && <p className="mb-4 text-sm text-ink-secondary">{content.packages.note}</p>}
          <ProductGrid items={packages} currency={currency} />
        </section>
      )}

      {hasContent.devices(content) && (
        <section className="py-6">
          {content.devices.heading && <h2 className="mb-4 text-xl font-bold sm:text-2xl">{content.devices.heading}</h2>}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {content.devices.items.map((device) => (
              <li key={device} className="rounded-card border border-border bg-surface px-3 py-3 text-center text-sm">
                {device}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasContent.why(content) && (
        <section className="py-6">
          {content.why.heading && <h2 className="mb-4 text-xl font-bold sm:text-2xl">{content.why.heading}</h2>}
          <div className="grid gap-3 sm:grid-cols-3">
            {content.why.items.map((item) => (
              <Card key={item.title} className="space-y-1">
                <h3 className="font-semibold">{item.title}</h3>
                {item.body && <p className="text-sm leading-6 text-ink-secondary">{item.body}</p>}
              </Card>
            ))}
          </div>
        </section>
      )}

      {hasContent.faq(content) && (
        <section className="py-6">
          {content.faq.heading && <h2 className="mb-4 text-xl font-bold sm:text-2xl">{content.faq.heading}</h2>}
          <div className="divide-y divide-border rounded-card border border-border bg-surface">
            {content.faq.items.map((item) => (
              <details key={item.question} className="group px-4">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 font-medium [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{item.question}</span>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rotate-90 text-ink-secondary transition-transform group-open:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="pb-4 text-sm leading-7 text-ink-secondary">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {hasContent.related(content) && (
        <section className="py-6">
          {content.related.heading && <h2 className="mb-3 text-xl font-bold sm:text-2xl">{content.related.heading}</h2>}
          <ul className="flex flex-wrap gap-2">
            {content.related.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
