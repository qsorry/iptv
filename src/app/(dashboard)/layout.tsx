export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-l bg-white p-4">
        {/* القائمة الجانبية للوحة التحكم */}
        <nav className="space-y-2 text-sm">
          <a href="/dashboard" className="block rounded px-3 py-2 hover:bg-gray-100">
            الرئيسية
          </a>
        </nav>
      </aside>
      <section className="flex-1 p-6">{children}</section>
    </div>
  );
}
