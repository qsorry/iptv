import { redirect } from "next/navigation";
import { requireSession } from "@/core/tenancy/server";
import { listMemberships } from "@/modules/identity";
import { createStore } from "@/modules/stores";
import { Button } from "@/components/ui/button";

/** أول متجر للمستخدم الجديد. */
export default async function OnboardingPage() {
  const session = await requireSession();
  if ((await listMemberships(session.user.id)).length > 0) redirect("/admin/dashboard");

  async function action(formData: FormData) {
    "use server";
    const s = await requireSession();
    await createStore({ name: String(formData.get("name")), ownerUserId: s.user.id });
    redirect("/admin/dashboard");
  }

  return (
    <form action={action} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">أنشئ متجرك الأول</h1>
      <label className="block text-sm">
        اسم المتجر
        <input name="name" required minLength={2} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <Button type="submit">إنشاء المتجر</Button>
    </form>
  );
}
