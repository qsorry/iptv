import { getAdminContext } from "@/core/tenancy/server";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";

const titles: Record<string, string> = { orders: "الطلبات", customers: "العملاء", inventory: "المخزون", settings: "الإعدادات" };

export default async function Page() {
  await getAdminContext();
  return (
    <div>
      <PageHeader title={titles["customers"]} />
      <EmptyState title="قريباً" description="هذا القسم قيد الإنشاء." />
    </div>
  );
}
