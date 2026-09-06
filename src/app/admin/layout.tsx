import Link from "next/link";
import { requireSession } from "@/core/tenancy/server";
import { SignOutButton } from "@/components/shared/sign-out-button";

const nav = [
  { href: "/admin/dashboard", label: "الرئيسية" },
  { href: "/admin/products", label: "المنتجات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/inventory", label: "المخزون" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-l bg-white p-4">
        <div className="mb-6 text-lg font-bold">لوحة التحكم</div>
        <nav className="space-y-1 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded px-3 py-2 hover:bg-gray-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t pt-4 text-xs text-gray-500">
          <div className="truncate" dir="ltr">{session.user.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <section className="flex-1 p-6">{children}</section>
    </div>
  );
}
