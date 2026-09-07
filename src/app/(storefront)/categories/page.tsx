import type { Metadata } from "next";
import { getStorefrontStore } from "@/core/tenancy/server";
import { listPublicCategories } from "@/modules/catalog";
import { CategoryCard } from "@/components/commerce/category-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  const name = store?.name ?? "المتجر";
  return { title: "الأقسام", description: `تصفّح أقسام ${name}`, alternates: { canonical: "/categories" } };
}

/** فهرس الأقسام (هدف زر "الأقسام" في التنقّل السفلي). */
export default async function CategoriesIndexPage() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر على هذا العنوان" />;
  const cats = await listPublicCategories(store.id);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">الأقسام</h1>
      {cats.length === 0 ? (
        <EmptyState title="لا توجد أقسام بعد" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cats.map((c, i) => (
            <CategoryCard key={c.id} category={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
