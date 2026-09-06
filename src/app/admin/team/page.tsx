import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { listMembers, addMember, removeMember } from "@/modules/identity";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const roleLabel: Record<string, string> = { owner: "المالك", admin: "مدير", staff: "موظف" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAdminContext();
  const { error } = await searchParams;
  const members = await listMembers(ctx.storeId);

  async function invite(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await addMember(c, String(formData.get("email")), String(formData.get("role")) as "admin" | "staff");
    } catch (e) {
      redirect(`/admin/team?error=${encodeURIComponent(e instanceof AppError ? e.message : "خطأ")}`);
    }
    revalidatePath("/admin/team");
    redirect("/admin/team");
  }
  async function kick(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try { await removeMember(c, String(formData.get("id"))); } catch { /* ignore */ }
    revalidatePath("/admin/team");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="الفريق" />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Card className="mb-4">
        <form action={invite} className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-sm">البريد الإلكتروني<Input name="email" type="email" dir="ltr" required className="mt-1" /></label>
          <div className="w-full sm:w-40">
            <Select
              name="role"
              title="الدور"
              required
              options={[
                { value: "staff", label: "موظف" },
                { value: "admin", label: "مدير" },
              ]}
            />
          </div>
          <Button type="submit" size="sm">إضافة</Button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">يجب أن يكون لدى العضو حساب مسجّل على المنصة أولاً.</p>
      </Card>

      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{m.name ?? "—"}</div>
              <div className="truncate text-xs text-[var(--muted)]" dir="ltr">{m.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted)]">{roleLabel[m.role] ?? m.role}</span>
              {m.role !== "owner" && (
                <form action={kick}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-red-600 hover:underline">إزالة</button></form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
