import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { ordersByEmail } from "@/modules/customers";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "طلباتي" };
const payLabel: Record<string, string> = { unpaid: "بانتظار الدفع", paid: "مدفوع", failed: "فشل", refunded: "مُسترجع" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const { email } = await searchParams;
  const list = email ? await ordersByEmail(store.id, email) : [];

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">طلباتي</h1>
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-sm">بريدك الإلكتروني<Input name="email" type="email" defaultValue={email} dir="ltr" required className="mt-1" /></label>
          <Button type="submit" size="sm">عرض طلباتي</Button>
        </form>
      </Card>

      {email && (list.length === 0 ? (
        <EmptyState title="لا توجد طلبات بهذا البريد" />
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="flex items-center justify-between transition hover:border-[var(--brand)]">
                <div>
                  <div className="font-medium">طلب {o.orderNumber}</div>
                  <div className="text-xs text-[var(--muted)]">{payLabel[o.paymentStatus] ?? o.paymentStatus}</div>
                </div>
                <span className="font-semibold" dir="ltr">{formatMoney(toMinor(o.grandTotal), o.currencyCode)}</span>
              </Card>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
