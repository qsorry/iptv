import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, productVariants, products, productMedia } from "@/infrastructure/database/schema";
import { NotFoundError, ValidationError } from "@/core/errors";
import { toMinor, sum, multiply, type Minor } from "@/core/money";

/** يجلب سلة نشطة بالمعرّف أو ينشئ واحدة للمتجر. */
export async function getOrCreateCart(storeId: string, cartId?: string) {
  if (cartId) {
    const existing = await db.query.carts.findFirst({
      where: and(eq(carts.id, cartId), eq(carts.storeId, storeId), eq(carts.status, "active")),
    });
    if (existing) return existing;
  }
  const [cart] = await db.insert(carts).values({ storeId, currencyCode: "SAR" }).returning();
  return cart;
}

/** يضيف متغيّراً للسلة (أو يزيد الكمية). يرجّع معرّف السلة. */
export async function addToCart(storeId: string, cartId: string | undefined, variantId: string, quantity = 1) {
  const variant = await db.query.productVariants.findFirst({
    where: and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId), eq(productVariants.isActive, true)),
  });
  if (!variant) throw new NotFoundError("المنتج", variantId);

  const cart = await getOrCreateCart(storeId, cartId);
  const existing = await db.query.cartItems.findFirst({ where: and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)) });
  if (existing) {
    await db.update(cartItems).set({ quantity: existing.quantity + quantity, updatedAt: new Date() }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId: cart.id, variantId, quantity, unitPrice: variant.price });
  }
  return cart.id;
}

export async function updateCartItem(cartId: string, itemId: string, quantity: number) {
  if (quantity < 1) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
    return;
  }
  await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
}

export async function removeCartItem(cartId: string, itemId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
}

export interface CartView {
  id: string;
  items: {
    id: string;
    variantId: string;
    productName: string;
    productSlug: string;
    image: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: Minor;
  }[];
  subtotal: Minor;
  count: number;
}

/** يعرض محتوى السلة بالأسعار الحالية للعرض. */
export async function getCartView(storeId: string, cartId: string): Promise<CartView | null> {
  const cart = await db.query.carts.findFirst({ where: and(eq(carts.id, cartId), eq(carts.storeId, storeId), eq(carts.status, "active")) });
  if (!cart) return null;
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (lines.length === 0) return { id: cart.id, items: [], subtotal: 0, count: 0 };

  const rows = await db
    .select({ variantId: productVariants.id, price: productVariants.price, name: products.name, slug: products.slug, productId: products.id })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, lines.map((l) => l.variantId)));
  const byVariant = new Map(rows.map((r) => [r.variantId, r]));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const imgs = productIds.length
    ? await db.select({ productId: productMedia.productId, url: productMedia.url, isPrimary: productMedia.isPrimary }).from(productMedia).where(inArray(productMedia.productId, productIds))
    : [];
  const imgByProduct = new Map<string, string>();
  for (const im of imgs) if (im.isPrimary || !imgByProduct.has(im.productId)) imgByProduct.set(im.productId, im.url);

  const items = lines
    .map((l) => {
      const v = byVariant.get(l.variantId);
      if (!v) return null;
      const unit = toMinor(v.price);
      return {
        id: l.id,
        variantId: l.variantId,
        productName: v.name,
        productSlug: v.slug,
        image: imgByProduct.get(v.productId) ?? null,
        unitPrice: v.price,
        quantity: l.quantity,
        lineTotal: multiply(unit, l.quantity),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { id: cart.id, items, subtotal: sum(...items.map((i) => i.lineTotal)), count: items.reduce((n, i) => n + i.quantity, 0) };
}

export function assertCart(cart: CartView | null): asserts cart is CartView {
  if (!cart || cart.items.length === 0) throw new ValidationError("السلة فارغة");
}
