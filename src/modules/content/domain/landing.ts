import { z } from "zod";

/**
 * صفحة هبوط تجارية ≠ مقال. بنيتها أقسام معروفة تُرسم بترتيب ثابت
 * وتُترجم إلى بيانات مهيكلة (FAQPage · ItemList · BreadcrumbList).
 *
 * قاعدة حاكمة: **لا سعر في هذا الكائن**. الباقات تشير إلى منتجات الكتالوج
 * بمعرّفاتها، ويُقرأ السعر والتوفّر من هناك — سعر مكتوب في الصفحة يوماً ما
 * سيخالف صفحة المنتج، وجوجل يزحف للاثنين ويقارن.
 */
const line = (max: number) => z.string().trim().max(max);

export const landingSchema = z.object({
  hero: z
    .object({
      heading: line(120).default(""),
      subheading: line(300).default(""),
      ctaLabel: line(40).default(""),
      ctaHref: line(300).default(""),
      /** نقاط سريعة تحت العنوان (تفعيل فوري · دعم فني …). */
      badges: z.array(line(40)).max(6).default([]),
    })
    .default({}),
  packages: z
    .object({
      heading: line(120).default(""),
      note: line(300).default(""),
      /** معرّفات منتجات من الكتالوج: السعر والتوفّر يُقرآن منها. */
      productIds: z.array(z.string().uuid()).max(12).default([]),
    })
    .default({}),
  devices: z
    .object({
      heading: line(120).default(""),
      items: z.array(line(60)).max(20).default([]),
    })
    .default({}),
  why: z
    .object({
      heading: line(120).default(""),
      items: z.array(z.object({ title: line(80), body: line(300).default("") })).max(12).default([]),
    })
    .default({}),
  faq: z
    .object({
      heading: line(120).default(""),
      items: z.array(z.object({ question: line(200), answer: line(1000) })).max(30).default([]),
    })
    .default({}),
  related: z
    .object({
      heading: line(120).default(""),
      links: z.array(z.object({ label: line(80), href: line(300) })).max(12).default([]),
    })
    .default({}),
});

export type LandingContent = z.infer<typeof landingSchema>;

export const EMPTY_LANDING: LandingContent = landingSchema.parse({});

/** يقرأ محتوى صفحة الهبوط بتسامح: قيمة تالفة تعود فارغة ولا تُسقط الصفحة. */
export function readLanding(value: unknown): LandingContent {
  const parsed = landingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : EMPTY_LANDING;
}

/* ── تحرير سطري: «عنوان | نص» في كل سطر ────────────────────────────────
   محرر بصري كامل لكل قسم يعني آلاف الأسطر في الواجهة؛ التحرير السطري
   يعطي التاجر بنية حقيقية بنموذج بسيط، والتحليل هنا نقي وقابل للاختبار. */

const SEPARATOR = "|";

export function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** سطر «الجزء الأول | الجزء الثاني»؛ سطر بلا فاصل يُهمل جزؤه الثاني. */
export function parsePairs(raw: string): { first: string; second: string }[] {
  return parseLines(raw)
    .map((l) => {
      const at = l.indexOf(SEPARATOR);
      return at === -1
        ? { first: l, second: "" }
        : { first: l.slice(0, at).trim(), second: l.slice(at + 1).trim() };
    })
    .filter((p) => p.first.length > 0);
}

export const formatPairs = (rows: { first: string; second: string }[]): string =>
  rows.map((r) => (r.second ? `${r.first} ${SEPARATOR} ${r.second}` : r.first)).join("\n");

/** بيانات FAQPage المهيكلة — أعلى عائد بنيوي لصفحة تجارية. */
export function faqJsonLd(items: LandingContent["faq"]["items"]) {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/** ItemList للباقات: يربط الصفحة بمنتجات حقيقية بأسعارها من الكتالوج. */
export function packagesJsonLd(
  items: { name: string; url: string; price: string; currency: string; available: boolean }[],
) {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: item.name,
        url: item.url,
        offers: {
          "@type": "Offer",
          price: item.price,
          priceCurrency: item.currency,
          availability: item.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      },
    })),
  };
}

/** هل يستحق القسم الرسم؟ قسم فارغ لا يُرسم عنوانه. */
export const hasContent = {
  hero: (c: LandingContent) => Boolean(c.hero.heading || c.hero.subheading),
  packages: (c: LandingContent) => c.packages.productIds.length > 0,
  devices: (c: LandingContent) => c.devices.items.length > 0,
  why: (c: LandingContent) => c.why.items.length > 0,
  faq: (c: LandingContent) => c.faq.items.length > 0,
  related: (c: LandingContent) => c.related.links.length > 0,
};
