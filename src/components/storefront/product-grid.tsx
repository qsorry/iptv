import { ProductGrid as Grid, type ProductCardData } from "@/components/commerce/product-grid";

export type GridProduct = ProductCardData;

/** واجهة قديمة: تحوّل layout (grid/list/compact) إلى variant بطاقة المنتج من السجل. */
export function ProductGrid({ items, currency, layout = "grid" }: { items: GridProduct[]; currency: string; layout?: "grid" | "list" | "compact" }) {
  const variant = layout === "list" ? "horizontal" : layout === "compact" ? "compact" : "default";
  return <Grid items={items} currency={currency} variant={variant} />;
}
