import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./section-heading";

export interface Testimonial {
  id: string;
  rating: number;
  body: string | null;
  authorName: string | null;
  verified: boolean;
  productName: string;
  productSlug: string;
}

/** آراء العملاء (تقييمات معتمدة فقط). */
export function Testimonials({ title = "آراء عملائنا", items }: { title?: string; items: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--rating-color)]" dir="ltr" aria-label={`${t.rating} من 5`}>
                {"★".repeat(t.rating)}
                {"☆".repeat(5 - t.rating)}
              </span>
              {t.verified && <Badge variant="success">شراء موثّق</Badge>}
            </div>
            {t.body && <p className="line-clamp-4 text-sm leading-relaxed">{t.body}</p>}
            <div className="mt-auto flex items-center justify-between text-xs text-ink-secondary">
              <span>{t.authorName ?? "عميل"}</span>
              <Link href={`/products/${encodeURIComponent(t.productSlug)}`} className="hover:text-ink">
                {t.productName}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
