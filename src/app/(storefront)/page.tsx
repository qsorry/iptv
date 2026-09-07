import type { Metadata } from "next";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository, listPublicCategories } from "@/modules/catalog";
import { storeTestimonials } from "@/modules/reviews";
import { resolveHomeLayout } from "@/modules/stores";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionRenderer, type HomeData } from "@/components/sections/section-renderer";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  if (!store) return { title: "متجر غير متوفر" };
  const title = store.name;
  const description = store.description ?? `تسوّق من ${store.name}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, images: store.logoUrl ? [store.logoUrl] : undefined, type: "website", siteName: store.name },
    twitter: { card: "summary", title, description },
  };
}

/**
 * الصفحة الرئيسية تُرسم من مصفوفة أقسام محلولة على الخادم (Layout Preset)،
 * لا من JSX ثابت. البيانات تُجلب مرة واحدة وتُمرَّر لكل قسم.
 */
export default async function StorefrontHome() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر على هذا العنوان" />;
  const [products, categories, testimonials, settingsRow] = await Promise.all([
    productRepository.listPublic(store.id),
    listPublicCategories(store.id),
    storeTestimonials(store.id, 6),
    db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) }),
  ]);
  const layout = resolveHomeLayout(settingsRow?.settings as Record<string, unknown> | undefined);

  const data: HomeData = {
    store: { name: store.name, description: store.description, logoUrl: store.logoUrl },
    currency: store.currencyCode,
    products,
    categories,
    testimonials,
  };

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name,
    ...(store.description ? { description: store.description } : {}),
    ...(store.logoUrl ? { logo: store.logoUrl } : {}),
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.name,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "/search?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
      {layout.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} data={data} />
      ))}
      {products.length === 0 && <EmptyState title="لا توجد منتجات بعد" />}
    </div>
  );
}
