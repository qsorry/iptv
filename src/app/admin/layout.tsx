import { requireSession } from "@/core/tenancy/server";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AdminShell email={session.user.email}>{children}</AdminShell>;
}
