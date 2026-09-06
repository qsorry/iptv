import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { getPageById, upsertPage } from "@/modules/content";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const { error } = await searchParams;
  const page = await getPageById(ctx.storeId, id);
  if (!page) notFound();
  async function action(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await upsertPage(c, { id, title: String(formData.get("title")), body: String(formData.get("body") || ""), seoDescription: String(formData.get("seo") || ""), status: formData.get("publish") ? "published" : "draft" });
    } catch (e) {
      redirect(`/admin/pages/${id}?error=${encodeURIComponent(e instanceof AppError ? e.message : "خطأ")}`);
    }
    redirect("/admin/pages");
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title={page.title} action={<Link href="/admin/pages"><Button variant="secondary">رجوع</Button></Link>} />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={action} className="space-y-4">
        <Card className="space-y-4">
          <label className="block text-sm">العنوان<Input name="title" defaultValue={page.title} required className="mt-1" /></label>
          <label className="block text-sm">المحتوى
            <textarea name="body" rows={10} defaultValue={page.body ?? ""} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base" />
          </label>
          <label className="block text-sm">وصف SEO<Input name="seo" defaultValue={page.seoDescription ?? ""} className="mt-1" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked={page.status === "published"} className="h-4 w-4" />منشور</label>
          <Button type="submit">حفظ</Button>
        </Card>
      </form>
    </div>
  );
}
