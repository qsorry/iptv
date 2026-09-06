import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

const statusLabel: Record<string, string> = { draft: "مسودة", active: "منشور", archived: "مؤرشف" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await getAdminContext();
  const { page } = await searchParams;
  const result = await productRepository.list(ctx.storeId, { page: Number(page) || 1, perPage: 20 });

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
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="font-medium">{p.name}</div>
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
                    <td className="p-3 text-[var(--muted)]">{p.productType}</td>
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
