/**
 * Smart Souq — VARIANT REGISTRY
 * المصدر الوحيد للحقيقة. أي variant غير مذكور هنا لا وجود له.
 * إضافة variant = تعديل هذا الملف + DESIGN_SYSTEM.md في نفس التغيير.
 *
 * الـ variant يعني تغييراً حقيقياً في التخطيط أو التسلسل الهرمي أو الغرض.
 * اللون والشكل مسؤولية الثيم (رموز)، لا الـ variant.
 */

export const VARIANTS = {
  button: ["primary", "secondary", "outline", "ghost"],
  buttonSize: ["sm", "md", "lg"],
  card: ["default", "elevated", "flat"],
  badge: ["default", "success", "warning", "error"],
  alert: ["info", "success", "warning", "error"],
  productCard: ["default", "featured", "compact", "horizontal"],
  categoryCard: ["default", "compact"],
  hero: ["centered", "split", "banner"],
  header: ["standard", "minimal"],
} as const;

export type ButtonVariant = (typeof VARIANTS.button)[number];
export type ButtonSize = (typeof VARIANTS.buttonSize)[number];
export type CardVariant = (typeof VARIANTS.card)[number];
export type BadgeVariant = (typeof VARIANTS.badge)[number];
export type AlertVariant = (typeof VARIANTS.alert)[number];
export type ProductCardVariant = (typeof VARIANTS.productCard)[number];
export type CategoryCardVariant = (typeof VARIANTS.categoryCard)[number];
export type HeroVariant = (typeof VARIANTS.hero)[number];
export type HeaderVariant = (typeof VARIANTS.header)[number];

/** يتحقق أن القيمة variant مسجّل لهذا المكوّن (مفيد عند قراءة إعدادات من JSON). */
export function isVariant<K extends keyof typeof VARIANTS>(component: K, value: unknown): value is (typeof VARIANTS)[K][number] {
  return typeof value === "string" && (VARIANTS[component] as readonly string[]).includes(value);
}

/**
 * أسماء variants ممنوعة — تُرفض في المراجعة:
 * modern, modern-v2, premium-new, special-card, gradient-style,
 * custom-layout, purple, rounded, blue, big, new
 */
