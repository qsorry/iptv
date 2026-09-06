import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { getAdminContext } from "@/core/tenancy/server";
import { db } from "@/infrastructure/database/client";
import { products, productVariants } from "@/infrastructure/database/schema";
import { createManualOrder } from "@/modules/orders";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAdminContext();
  const { error } = await searchParams;

  const rows = await db
    .select({ variantId: productVariants.id, price: productVariants.price, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.storeId, ctx.storeId), eq(productVariants.isDefault, true), eq(products.status, "active"), isNull(products.deletedAt)));

  async function action(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let orderId: string | null = null;
    try {
      const order = await createManualOrder(c, {
        variantId: String(formData.get("variantId")),
        quantity: Number(formData.get("quantity")) || 1,
        customerEmail: String(formData.get("email") || "") || undefined,
        customerName: String(formData.get("name") || "") || undefined,
      });
      orderId = order.id;
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "تعذّر إنشاء الطلب";
      redirect(`/admin/orders/new?error=${encodeURIComponent(msg)}`);
    }
    redirect(`/admin/orders/${orderId}`);
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="طلب يدوي جديد" action={<Link href="/admin/orders"><Button variant="secondary">رجوع</Button></Link>} />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState title="لا توجد منتجات منشورة" description="انشر منتجاً أولاً ثم أنشئ طلباً." action={<Link href="/admin/products/new"><Button>+ منتج</Button></Link>} />
      ) : (
        <form action={action} className="space-y-4">
          <label className="block text-sm">
            المنتج
            <Select
              name="variantId"
              title="المنتج"
              required
              className="mt-1"
              options={rows.map((r) => ({ value: r.variantId, label: r.name, description: `${r.price} ر.س` }))}
            />
          </label>
          <label className="block text-sm">
            الكمية
            <Input name="quantity" type="number" min="1" defaultValue="1" dir="ltr" className="mt-1" />
          </label>
          <label className="block text-sm">
            بريد العميل (اختياري)
            <Input name="email" type="email" dir="ltr" className="mt-1" />
          </label>
          <label className="block text-sm">
            اسم العميل (اختياري)
            <Input name="name" className="mt-1" />
          </label>
          <Button type="submit">إنشاء الطلب</Button>
        </form>
      )}
    </div>
  );
}
