import Link from "next/link";
import { redirect } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId, clearCartId } from "@/core/tenancy/cart-cookie";
import { getCartView } from "@/modules/carts";
import { createOrder } from "@/modules/orders";
import { AppError } from "@/core/errors";
import { formatMoney, percentOf } from "@/core/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "إتمام الشراء" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const { error } = await searchParams;
  const cartId = await readCartId(store.id);
  const cart = cartId ? await getCartView(store.id, cartId) : null;

  if (!cart || cart.items.length === 0) {
    return <EmptyState title="سلتك فارغة" action={<Link href="/"><Button>تصفّح المنتجات</Button></Link>} />;
  }

  const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) });
  const taxPercent = Number((settings?.settings as Record<string, unknown> | undefined)?.taxPercent ?? 15);
  const tax = percentOf(cart.subtotal, taxPercent);

  async function placeOrder(formData: FormData) {
    "use server";
    const s = await getStorefrontStore();
    if (!s) return;
    const cid = await readCartId(s.id);
    if (!cid) redirect("/cart");

    let orderId: string | null = null;
    try {
      const order = await createOrder({
        storeId: s.id,
        cartId: cid!,
        couponCode: String(formData.get("coupon") || "") || undefined,
        shippingAddress: {
          fullName: String(formData.get("name") || "عميل"),
          phone: String(formData.get("phone") || "") || undefined,
          country: "SA",
          city: String(formData.get("city") || "-"),
        },
        notes: String(formData.get("notes") || "") || undefined,
      });
      orderId = order.id;
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "تعذّر إتمام الطلب";
      redirect(`/checkout?error=${encodeURIComponent(msg)}`);
    }
    // ربط بريد العميل بالطلب لاحقاً عبر customer؛ الآن نمرّر الاسم فقط.
    await clearCartId(s.id);
    redirect(`/orders/${orderId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">إتمام الشراء</h1>
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={placeOrder} className="space-y-3">
          <Card className="space-y-3">
            <label className="block text-sm">الاسم<Input name="name" required className="mt-1" /></label>
            <label className="block text-sm">الجوال / واتساب<Input name="phone" dir="ltr" placeholder="+9665..." className="mt-1" /></label>
            <label className="block text-sm">المدينة<Input name="city" className="mt-1" /></label>
            <label className="block text-sm">كوبون خصم (اختياري)<Input name="coupon" dir="ltr" className="mt-1" /></label>
            <label className="block text-sm">ملاحظات (اختياري)<Input name="notes" className="mt-1" /></label>
          </Card>
          <Button type="submit" className="w-full">تأكيد الطلب</Button>
          <p className="text-center text-xs text-[var(--muted)]">بعد التأكيد سيتم التواصل معك لإتمام الدفع، وتظهر بيانات الاشتراك فور تأكيده.</p>
        </form>

        <Card className="h-fit space-y-2">
          <h2 className="font-medium">ملخص الطلب</h2>
          {cart.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>{it.productName} <span className="text-[var(--muted)]" dir="ltr">×{it.quantity}</span></span>
              <span dir="ltr">{formatMoney(it.lineTotal, store.currencyCode)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-sm">
            <span>المجموع الفرعي</span><span dir="ltr">{formatMoney(cart.subtotal, store.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm text-[var(--muted)]">
            <span>ضريبة ({taxPercent}%)</span><span dir="ltr">{formatMoney(tax, store.currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
            <span>الإجمالي التقريبي</span><span dir="ltr">{formatMoney(cart.subtotal + tax, store.currencyCode)}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">الكوبون يُحسب عند التأكيد.</p>
        </Card>
      </div>
    </div>
  );
}
