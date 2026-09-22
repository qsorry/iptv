import { BrandCard, type BrandCardData } from "@/components/commerce/brand-card";
import { SectionHeading } from "./section-heading";

/** شريط الماركات: تمرير أفقي على الجوال، وشبكة على الأكبر. */
export function BrandStrip({ title = "تسوّق حسب الماركة", brands }: { title?: string; brands: BrandCardData[] }) {
  if (brands.length === 0) return null;
  return (
    <section aria-labelledby="brands-heading">
      <SectionHeading title={title} />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:hidden">
        {brands.map((b) => (
          <BrandCard key={b.id} brand={b} className="w-28" />
        ))}
      </div>
      <div className="hidden grid-cols-3 gap-4 sm:grid md:grid-cols-4 lg:grid-cols-6">
        {brands.slice(0, 12).map((b) => (
          <BrandCard key={b.id} brand={b} />
        ))}
      </div>
    </section>
  );
}
