import Link from "next/link";
import { Container } from "@/components/ui/container";

/** Layout واجهة المتجر. يُحدَّد المتجر من الدومين عبر middleware (core/tenancy). */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] pt-[var(--safe-top)]">
        <Container className="flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="text-lg font-bold sm:text-xl">المتجر</Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            <Link href="/cart" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">السلة</Link>
            <Link href="/account" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">حسابي</Link>
          </nav>
        </Container>
      </header>
      <main className="pb-[calc(1.5rem+var(--safe-bottom))]">
        <Container className="py-4 sm:py-6">{children}</Container>
      </main>
    </>
  );
}
