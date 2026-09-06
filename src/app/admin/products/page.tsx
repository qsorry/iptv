import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

const statusLabel: Record<string, string> = { draft: "مسودة", active: "منشور", archived: "مؤرشف" };
const typeMeta: Record<string, { label: string; cls: string }> = {
  digital: { label: "رقمي", cls: "bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand)]" },
  physical: { label: "مادي", cls: "bg-amber-100 text-amber-700" },
  service: { label: "خدمة", cls: "bg-purple-100 text-purple-700" },
};

function TypeBadge({ type }: { type: string }) {
  const m = typeMeta[type] ?? { label: type, cls: "bg-black/5 text-[var(--muted)]" };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const ctx = await getAdminContext();
  const { page, type } = await searchParams;
  const activeType = type === "digital" || type === "physical" || type === "service" ? type : undefined;
  const [result, counts] = await Promise.all([
    productRepository.list(ctx.storeId, { page: Number(page) || 1, perPage: 20 }, { type: activeType }),
    productRepository.countsByType(ctx.storeId),
  ]);

  const tabs: { key: string | undefined; label: string; count: number }[] = [
    { key: undefined, label: "الكل", count: counts.all },
    { key: "digital", label: "رقمي", count: counts.digital },
    { key: "physical", label: "مادي (يُشحن)", count: counts.physical },
    { key: "service", label: "خدمة", count: counts.service },
  ];

  return (
    <div>
      <PageHeader
        title="المنتجات"
        action={
          <div className="flex gap-2">
            <Link href="/admin/products/import"><Button variant="secondary">استيراد</Button></Link>
            <Link href="/admin/products/new"><Button>+ منتج جديد</Button></Link>
          </div>
        }
      />

      {/* تصفية حسب النوع */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/products?type=${t.key}` : "/admin/products"}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              activeType === t.key ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-[var(--border)] hover:bg-black/5"
            }`}
          >
            {t.label} <span dir="ltr" className="opacity-70">({t.count})</span>
          </Link>
        ))}
      </div>

      {result.data.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات بعد"
          description="أضف أول منتج لتبدأ البيع."
          action={
            <Link href="/admin/products/new">
              <Button>+ منتج جديد</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* بطاقات على الجوال */}
          <div className="grid gap-3 sm:hidden">
            {result.data.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-black/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{p.name}</div>
                  <TypeBadge type={p.productType} />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">{statusLabel[p.status] ?? p.status}</div>
              </Link>
            ))}
          </div>

          {/* جدول على الكمبيوتر */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] sm:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-black/5 text-[var(--muted)]">
                <tr>
                  <th className="p-3 font-medium">الاسم</th>
                  <th className="p-3 font-medium">الحالة</th>
                  <th className="p-3 font-medium">النوع</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] hover:bg-black/5">
                    <td className="p-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    </td>
                    <td className="p-3 text-[var(--muted)]">{statusLabel[p.status] ?? p.status}</td>
                    <td className="p-3"><TypeBadge type={p.productType} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
