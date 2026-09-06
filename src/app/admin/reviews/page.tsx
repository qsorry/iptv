import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { listStoreReviews, moderateReview } from "@/modules/reviews";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const statusLabel: Record<string, string> = { pending: "بانتظار المراجعة", approved: "منشور", rejected: "مرفوض" };

export default async function ReviewsPage() {
  const ctx = await getAdminContext();
  const rows = await listStoreReviews(ctx.storeId);

  async function approve(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await moderateReview(c, String(formData.get("id")), "approved");
    revalidatePath("/admin/reviews");
  }
  async function reject(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await moderateReview(c, String(formData.get("id")), "rejected");
    revalidatePath("/admin/reviews");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="التقييمات" />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد تقييمات بعد" />
      ) : (
        <div className="space-y-3">
          {rows.map(({ review: r, productName }) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{productName}</span>
                <span className="text-sm text-yellow-500" dir="ltr">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              {r.title && <div className="text-sm font-medium">{r.title}</div>}
              {r.body && <p className="text-sm text-[var(--muted)]">{r.body}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">{r.authorName ?? "زائر"} — {statusLabel[r.status]}</span>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <form action={approve}><input type="hidden" name="id" value={r.id} /><Button size="sm">نشر</Button></form>
                    <form action={reject}><input type="hidden" name="id" value={r.id} /><Button size="sm" variant="secondary">رفض</Button></form>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
