import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { productRepository, updateProduct, deleteProduct, addProductImageUrl, removeProductImage, setPrimaryImage, uploadProductImages } from "@/modules/catalog";
import { addCodes, codeRepository } from "@/modules/codes";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const { error, ok } = await searchParams;
  const product = await productRepository.findByIdWithVariants(ctx.storeId, id);
  if (!product) notFound();

  const media = await productRepository.listMedia(id);
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const codes = defaultVariant ? await codeRepository.summary(ctx.storeId, defaultVariant.id) : null;

  async function saveDetails(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await updateProduct(c, id, {
        name: String(formData.get("name")),
        shortDescription: String(formData.get("shortDescription") || "") || null,
        description: String(formData.get("description") || "") || null,
        status: String(formData.get("status")) as "draft" | "active" | "archived",
        price: String(formData.get("price")),
      });
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر الحفظ";
    }
    revalidatePath(`/admin/products/${id}`);
    redirect(msg ? `/admin/products/${id}?error=${encodeURIComponent(msg)}` : `/admin/products/${id}?ok=1`);
  }

  async function remove() {
    "use server";
    const c = await getAdminContext();
    await deleteProduct(c, id);
    redirect("/admin/products");
  }

  async function addImage(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await addProductImageUrl(c, id, String(formData.get("url")));
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّرت إضافة الصورة";
    }
    revalidatePath(`/admin/products/${id}`);
    redirect(msg ? `/admin/products/${id}?error=${encodeURIComponent(msg)}` : `/admin/products/${id}?ok=1`);
  }

  async function deleteImage(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await removeProductImage(c, id, String(formData.get("mediaId")));
    revalidatePath(`/admin/products/${id}`);
  }

  async function uploadImages(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    let msg: string | null = null;
    try {
      if (files.length === 0) throw new AppError("اختر صورة واحدة على الأقل", "EMPTY", 422);
      const r = await uploadProductImages(c, id, files);
      msg = `تم رفع ${r.added} صورة`;
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر رفع الصور";
    }
    revalidatePath(`/admin/products/${id}`);
    redirect(`/admin/products/${id}?ok=${encodeURIComponent(msg)}`);
  }

  async function makePrimary(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await setPrimaryImage(c, id, String(formData.get("mediaId")));
    revalidatePath(`/admin/products/${id}`);
  }

  async function pasteCodes(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const variantId = String(formData.get("variantId"));
    let msg: string | null = null;
    try {
      const r = await addCodes(c, variantId, String(formData.get("codes")));
      msg = `added:${r.added}`;
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّرت إضافة الأكواد";
    }
    revalidatePath(`/admin/products/${id}`);
    redirect(`/admin/products/${id}?ok=${encodeURIComponent(msg)}`);
  }

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

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">تم الحفظ. {ok !== "1" ? ok : ""}</p>}

      <Tabs
        items={[
          {
            key: "details",
            label: "التفاصيل",
            content: (
              <form action={saveDetails} className="space-y-4">
                <Card className="space-y-4">
                  <label className="block text-sm">
                    الاسم
                    <Input name="name" defaultValue={product.name} required className="mt-1" />
                  </label>
                  <label className="block text-sm">
                    السعر (ر.س)
                    <Input name="price" type="number" step="0.01" min="0" defaultValue={defaultVariant?.price} dir="ltr" required className="mt-1" />
                  </label>
                  <label className="block text-sm">
                    الحالة
                    <select
                      name="status"
                      defaultValue={product.status}
                      className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
                    >
                      <option value="draft">مسودة</option>
                      <option value="active">منشور</option>
                      <option value="archived">مؤرشف</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    وصف مختصر
                    <Input name="shortDescription" defaultValue={product.shortDescription ?? ""} className="mt-1" />
                  </label>
                  <label className="block text-sm">
                    الوصف
                    <textarea
                      name="description"
                      defaultValue={product.description ?? ""}
                      rows={4}
                      className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
                    />
                  </label>
                  <Button type="submit">حفظ التغييرات</Button>
                </Card>
              </form>
            ),
          },
          {
            key: "images",
            label: `الصور (${media.length})`,
            content: (
              <Card className="space-y-5">
                {media.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {media.map((m) => (
                      <div key={m.id} className={`relative overflow-hidden rounded-[var(--radius)] border ${m.isPrimary ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : "border-[var(--border)]"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt={m.altText ?? ""} className="aspect-square w-full object-cover" />
                        {m.isPrimary && (
                          <span className="absolute right-1 top-1 rounded bg-[var(--brand)] px-1.5 py-0.5 text-[10px] text-white">رئيسية</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1">
                          {!m.isPrimary && (
                            <form action={makePrimary}>
                              <input type="hidden" name="mediaId" value={m.id} />
                              <button className="text-[11px] text-white hover:underline">تعيين رئيسية</button>
                            </form>
                          )}
                          <form action={deleteImage} className="ml-auto">
                            <input type="hidden" name="mediaId" value={m.id} />
                            <button className="text-[11px] text-red-200 hover:underline">حذف</button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form action={uploadImages} className="space-y-2">
                  <label className="block text-sm font-medium">رفع صور (يمكن اختيار أكثر من صورة)</label>
                  <input
                    type="file"
                    name="files"
                    accept="image/*"
                    multiple
                    className="block w-full text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-2 file:text-sm"
                  />
                  <Button type="submit" size="sm">رفع الصور</Button>
                </form>

                <form action={addImage} className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                  <span className="w-full text-xs text-[var(--muted)]">أو أضف صورة برابط:</span>
                  <Input name="url" placeholder="https://.../image.jpg" dir="ltr" className="min-w-0 flex-1" />
                  <Button type="submit" size="sm" variant="secondary">إضافة رابط</Button>
                </form>
              </Card>
            ),
          },
          ...(defaultVariant
            ? [
                {
                  key: "codes",
                  label: `الأكواد${codes ? ` (${codes.available})` : ""}`,
                  content: (
                    <Card className="space-y-4">
                      {codes && (
                        <div className="flex flex-wrap gap-6 text-sm">
                          <Stat label="متاح" value={codes.available} strong />
                          <Stat label="مُسلَّم" value={codes.delivered} />
                          <Stat label="محجوز" value={codes.reserved} />
                        </div>
                      )}
                      <form action={pasteCodes} className="space-y-2">
                        <input type="hidden" name="variantId" value={defaultVariant.id} />
                        <label className="block text-sm">الصق الأكواد (كل كود في سطر مستقل)</label>
                        <textarea
                          name="codes"
                          rows={6}
                          dir="ltr"
                          placeholder={"HOST:http://ssouqhost.vip|UserName:xxxx|Password:yyyy\nHOST:http://ssouqhost.vip|UserName:aaaa|Password:bbbb"}
                          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs"
                        />
                        <Button type="submit" size="sm">إضافة الأكواد</Button>
                        <p className="text-xs text-[var(--muted)]">
                          كل سطر كود واحد. تُسلَّم تلقائياً عند نجاح الدفع، وتظهر للعميل مفصولة سطراً بسطر عند علامة |. المكرر يُتجاهل.
                        </p>
                      </form>
                    </Card>
                  ),
                },
              ]
            : []),
          {
            key: "danger",
            label: "خطر",
            content: (
              <Card>
                <form action={remove}>
                  <Button type="submit" variant="secondary" className="border-red-300 text-red-600">حذف المنتج</Button>
                  <p className="mt-2 text-xs text-[var(--muted)]">يُخفى المنتج ويبقى تاريخ الطلبات محفوظاً.</p>
                </form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div className={strong ? "text-xl font-bold" : "text-xl"}>{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
