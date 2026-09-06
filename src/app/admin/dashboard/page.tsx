import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const ctx = await getAdminContext();
  const products = await productRepository.list(ctx.storeId, { page: 1, perPage: 1 });

  return (
    <div>
      <PageHeader title={ctx.storeName} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="المنتجات" value={products.total} href="/admin/products" />
        <Stat label="الطلبات" value={0} href="/admin/orders" />
        <Stat label="العملاء" value={0} href="/admin/customers" />
      </div>

      <div className="mt-6">
        <Link href="/admin/products/new">
          <Button>+ أضف منتجاً</Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-[var(--brand)]">
        <div className="text-2xl font-bold sm:text-3xl">{value}</div>
        <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
      </Card>
    </Link>
  );
}
