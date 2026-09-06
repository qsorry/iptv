import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { upsertPost } from "@/modules/content";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function BlogEditor({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAdminContext();
  void ctx;
  const { error } = await searchParams;
  async function action(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await upsertPost(c, { title: String(formData.get("title")), excerpt: String(formData.get("excerpt") || ""), body: String(formData.get("body") || ""), coverImage: String(formData.get("cover") || ""), seoDescription: String(formData.get("seo") || ""), status: formData.get("publish") ? "published" : "draft" });
    } catch (e) {
      redirect(`/admin/blog/new?error=${encodeURIComponent(e instanceof AppError ? e.message : "خطأ")}`);
    }
    redirect("/admin/blog");
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="مقال جديد" action={<Link href="/admin/blog"><Button variant="secondary">رجوع</Button></Link>} />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={action} className="space-y-4">
        <Card className="space-y-4">
          <label className="block text-sm">العنوان<Input name="title" required className="mt-1" /></label>
          <label className="block text-sm">مقتطف<Input name="excerpt" className="mt-1" /></label>
          <label className="block text-sm">رابط صورة الغلاف<Input name="cover" dir="ltr" className="mt-1" /></label>
          <label className="block text-sm">المحتوى (HTML مسموح)
            <textarea name="body" rows={12} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base" />
          </label>
          <label className="block text-sm">وصف SEO<Input name="seo" className="mt-1" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" className="h-4 w-4" />منشور</label>
          <Button type="submit">حفظ</Button>
        </Card>
      </form>
    </div>
  );
}
