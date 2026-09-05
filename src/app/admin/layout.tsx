import Link from "next/link";

const nav = [
  { href: "/admin/dashboard", label: "الرئيسية" },
  { href: "/admin/products", label: "المنتجات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/inventory", label: "المخزون" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-l bg-white p-4">
        <div className="mb-6 text-lg font-bold">لوحة التحكم</div>
        <nav className="space-y-1 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded px-3 py-2 hover:bg-gray-100">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="flex-1 p-6">{children}</section>
    </div>
  );
}
