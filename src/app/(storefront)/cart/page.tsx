import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId } from "@/core/tenancy/cart-cookie";
import { getCartView, updateCartItem, removeCartItem } from "@/modules/carts";
import { formatMoney } from "@/core/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "سلة التسوق" };

export default async function CartPage() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const cartId = await readCartId(store.id);
  const cart = cartId ? await getCartView(store.id, cartId) : null;

  async function update(formData: FormData) {
    "use server";
    const s = await getStorefrontStore();
    const cid = s ? await readCartId(s.id) : undefined;
    if (cid) await updateCartItem(cid, String(formData.get("itemId")), Number(formData.get("quantity")) || 1);
    revalidatePath("/cart");
  }
  async function remove(formData: FormData) {
    "use server";
    const s = await getStorefrontStore();
    const cid = s ? await readCartId(s.id) : undefined;
    if (cid) await removeCartItem(cid, String(formData.get("itemId")));
    revalidatePath("/cart");
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold sm:text-2xl">سلة التسوق</h1>
        <EmptyState title="سلتك فارغة" action={<Link href="/"><Button>تصفّح المنتجات</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">سلة التسوق</h1>
      <div className="space-y-3">
        {cart.items.map((it) => (
          <Card key={it.id} className="flex items-center gap-3">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt={it.productName} className="h-16 w-16 rounded-[var(--radius)] object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-[var(--radius)] bg-black/5" />
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/products/${encodeURIComponent(it.productSlug)}`} className="font-medium hover:underline">{it.productName}</Link>
              <div className="text-sm text-[var(--muted)]" dir="ltr">{formatMoney(it.lineTotal, store.currencyCode)}</div>
            </div>
            <form action={update} className="flex items-center gap-1">
              <input type="hidden" name="itemId" value={it.id} />
              <input name="quantity" type="number" min="1" defaultValue={it.quantity} dir="ltr" className="w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm" />
              <Button type="submit" size="sm" variant="secondary">تحديث</Button>
            </form>
            <form action={remove}>
              <input type="hidden" name="itemId" value={it.id} />
              <button className="text-xs text-red-600 hover:underline">حذف</button>
            </form>
          </Card>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
        <span className="font-semibold">المجموع الفرعي</span>
        <span className="font-semibold" dir="ltr">{formatMoney(cart.subtotal, store.currencyCode)}</span>
      </div>
      <Link href="/checkout" className="mt-4 block">
        <Button className="w-full">إتمام الشراء</Button>
      </Link>
    </div>
  );
}
