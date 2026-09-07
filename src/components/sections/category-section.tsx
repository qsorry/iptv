import { CategoryCard, type CategoryCardData } from "@/components/commerce/category-card";
import { SectionHeading } from "./section-heading";

/** التصنيفات: شريط أفقي مضغوط على الجوال، وشبكة بطاقات على الأكبر. */
export function CategorySection({ title = "تسوّق حسب الفئة", categories }: { title?: string; categories: CategoryCardData[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="categories-heading">
      <SectionHeading title={title} href="/categories" />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:hidden">
        {categories.map((c, i) => (
          <CategoryCard key={c.id} category={c} variant="compact" index={i} />
        ))}
      </div>
      <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-4">
        {categories.slice(0, 8).map((c, i) => (
          <CategoryCard key={c.id} category={c} index={i} />
        ))}
      </div>
    </section>
  );
}
