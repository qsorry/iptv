import { requireSession } from "@/core/tenancy/server";
import { listMemberships } from "@/modules/identity";
import { AdminShell } from "@/components/admin/admin-shell";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // لا نستخدم getAdminContext هنا حتى لا ندخل في حلقة إعادة توجيه مع صفحة onboarding.
  const session = await requireSession();
  const memberships = await listMemberships(session.user.id);
  const slug = memberships[0]?.storeSlug ?? "";
  const scheme = PLATFORM_DOMAIN.includes("localhost") ? "http" : "https";
  const storeUrl = slug ? `${scheme}://${slug}.${PLATFORM_DOMAIN}` : "";

  return (
    <AdminShell email={session.user.email} storeUrl={storeUrl}>
      {children}
    </AdminShell>
  );
}
