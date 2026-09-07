import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository, listCategoriesWithCounts, setProductsCategory, UNCATEGORIZED } from "@/modules/catalog";
import { AppError } from "@/core/errors";
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

/** اسم التصنيف أو تنبيه لطيف بأن المنتج بلا تصنيف. */
function CategoryCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--muted)]">بلا تصنيف</span>;
  return <span className="inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs">{name}</span>;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; category?: string; error?: string; ok?: string }>;
}) {
  const ctx = await getAdminContext();
  const { page, type, category, error, ok } = await searchParams;
  const activeType = type === "digital" || type === "physical" || type === "service" ? type : undefined;
  const [cats, counts, categoryCounts] = await Promise.all([
    listCategoriesWithCounts(ctx.storeId),
    productRepository.countsByType(ctx.storeId),
    productRepository.countsByCategory(ctx.storeId),
  ]);
  // تصفية التصنيف تُقبل فقط لتصنيف موجود أو للمنتجات غير المصنّفة.
  const activeCategory =
    category === UNCATEGORIZED ? UNCATEGORIZED : cats.some((c) => c.id === category) ? category : undefined;

  const result = await productRepository.list(
    ctx.storeId,
    { page: Number(page) || 1, perPage: 20 },
    { type: activeType, categoryId: activeCategory },
  );

  const query = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type: activeType, category: activeCategory, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  const typeTabs: { key: string | undefined; label: string; count: number }[] = [
    { key: undefined, label: "الكل", count: counts.all },
    { key: "digital", label: "رقمي", count: counts.digital },
    { key: "physical", label: "مادي (يُشحن)", count: counts.physical },
    { key: "service", label: "خدمة", count: counts.service },
  ];

  const uncategorized = categoryCounts[UNCATEGORIZED] ?? 0;

  /** ربط المنتجات المحدَّدة بتصنيف واحد (أو فكّ الربط) دفعة واحدة. */
  async function assignCategory(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const ids = formData.getAll("productId").map(String);
    const target = String(formData.get("targetCategoryId") || "");
    let msg: string;
    try {
      const r = await setProductsCategory(c, ids, target || null);
      msg = `ok=${encodeURIComponent(`تم تحديث تصنيف ${r.updated} منتج`)}`;
    } catch (e) {
      msg = `error=${encodeURIComponent(e instanceof AppError ? e.message : "تعذّر تحديث التصنيف")}`;
    }
    revalidatePath("/admin/products");
    redirect(`/admin/products?${msg}`);
  }

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

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">{ok}</p>}

      {/* تصفية حسب النوع */}
      <div className="mb-3 flex flex-wrap gap-2">
        {typeTabs.map((t) => (
          <Link
            key={t.label}
            href={query({ type: t.key, page: undefined })}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              activeType === t.key ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-[var(--border)] hover:bg-black/5"
            }`}
          >
            {t.label} <span dir="ltr" className="opacity-70">({t.count})</span>
          </Link>
        ))}
      </div>

      {/* تصفية حسب التصنيف */}
      {(cats.length > 0 || uncategorized > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">التصنيف:</span>
          <Link
            href={query({ category: undefined, page: undefined })}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              !activeCategory ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-[var(--border)] hover:bg-black/5"
            }`}
          >
            الكل
          </Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              href={query({ category: c.id, page: undefined })}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeCategory === c.id ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-[var(--border)] hover:bg-black/5"
              }`}
            >
              {c.name} <span dir="ltr" className="opacity-70">({c.productCount})</span>
            </Link>
          ))}
          {uncategorized > 0 && (
            <Link
              href={query({ category: UNCATEGORIZED, page: undefined })}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeCategory === UNCATEGORIZED ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-dashed border-[var(--border)] hover:bg-black/5"
              }`}
            >
              بلا تصنيف <span dir="ltr" className="opacity-70">({uncategorized})</span>
            </Link>
          )}
          <Link href="/admin/categories" className="text-xs text-[var(--brand)] underline">إدارة التصنيفات</Link>
        </div>
      )}

      {result.data.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات هنا"
          description={activeCategory || activeType ? "جرّب تصفية أخرى أو أضف منتجاً جديداً." : "أضف أول منتج لتبدأ البيع."}
          action={
            <Link href="/admin/products/new">
              <Button>+ منتج جديد</Button>
            </Link>
          }
        />
      ) : (
        /* نموذج واحد يضم الجدول والبطاقات: حدّد منتجات ثم اربطها بتصنيف دفعة واحدة. */
        <form action={assignCategory}>
          {/* بطاقات على الجوال */}
          <div className="grid gap-3 sm:hidden">
            {result.data.map((p) => (
              <div key={p.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start gap-3">
                  <input type="checkbox" name="productId" value={p.id} aria-label={`اختيار ${p.name}`} className="mt-1 h-4 w-4 shrink-0" />
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{p.name}</div>
                      <TypeBadge type={p.productType} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{statusLabel[p.status] ?? p.status}</span>
                      <CategoryCell name={p.categoryName} />
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* جدول على الكمبيوتر */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] sm:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-black/5 text-[var(--muted)]">
                <tr>
                  <th className="w-10 p-3"><span className="sr-only">اختيار</span></th>
                  <th className="p-3 font-medium">الاسم</th>
                  <th className="p-3 font-medium">التصنيف</th>
                  <th className="p-3 font-medium">الحالة</th>
                  <th className="p-3 font-medium">النوع</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] hover:bg-black/5">
                    <td className="p-3">
                      <input type="checkbox" name="productId" value={p.id} aria-label={`اختيار ${p.name}`} className="h-4 w-4" />
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    </td>
                    <td className="p-3"><CategoryCell name={p.categoryName} /></td>
                    <td className="p-3 text-[var(--muted)]">{statusLabel[p.status] ?? p.status}</td>
                    <td className="p-3"><TypeBadge type={p.productType} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* شريط الإجراء الجماعي */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <span className="text-sm">نقل المحدَّد إلى:</span>
            <select
              name="targetCategoryId"
              className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:max-w-xs"
            >
              <option value="">بلا تصنيف</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary">تطبيق</Button>
          </div>
        </form>
      )}

      {result.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={query({ page: String(result.page - 1) })} className="underline">السابق</Link>
          ) : (
            <span className="opacity-50">السابق</span>
          )}
          <span dir="ltr" className="text-[var(--muted)]">{result.page} / {result.totalPages}</span>
          {result.page < result.totalPages ? (
            <Link href={query({ page: String(result.page + 1) })} className="underline">التالي</Link>
          ) : (
            <span className="opacity-50">التالي</span>
          )}
        </nav>
      )}
    </div>
  );
}
