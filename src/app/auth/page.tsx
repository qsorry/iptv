import { redirect } from "next/navigation";
import { getSession } from "@/core/tenancy/server";
import { AuthForm } from "@/components/shared/auth-form";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4 pt-[calc(1rem+var(--safe-top))]">
      <AuthForm next={next ?? "/admin"} />
    </main>
  );
}
