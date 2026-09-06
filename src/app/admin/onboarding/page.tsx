import { redirect } from "next/navigation";
import { requireSession } from "@/core/tenancy/server";
import { listMemberships } from "@/modules/identity";
import { createStore } from "@/modules/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="mx-auto max-w-md p-4 pt-[calc(2rem+var(--safe-top))]">
      <h1 className="text-2xl font-semibold">أنشئ متجرك الأول</h1>
      <form action={action} className="mt-4 space-y-4">
        <label className="block text-sm">
          اسم المتجر
          <Input name="name" required minLength={2} className="mt-1" />
        </label>
        <Button type="submit">إنشاء المتجر</Button>
      </form>
    </div>
  );
}
