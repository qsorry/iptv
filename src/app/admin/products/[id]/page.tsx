import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const statusLabel: Record<string, string> = { draft: "مسودة", active: "منشور", archived: "مؤرشف" };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const product = await productRepository.findByIdWithVariants(ctx.storeId, id);
  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={product.name}
        action={
          <Link href="/admin/products">
            <Button variant="secondary">رجوع</Button>
          </Link>
        }
      />

      <Card className="space-y-3">
        <Row label="الحالة" value={statusLabel[product.status] ?? product.status} />
        <Row label="النوع" value={product.productType} />
        {product.shortDescription && <Row label="وصف مختصر" value={product.shortDescription} />}
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">الأسعار</h2>
      <div className="grid gap-3">
        {product.variants.map((v) => (
          <Card key={v.id} className="flex items-center justify-between">
            <span>{v.name}</span>
            <span className="font-semibold" dir="ltr">{formatMoney(toMinor(v.price), ctx.storeId ? "SAR" : "SAR")}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
