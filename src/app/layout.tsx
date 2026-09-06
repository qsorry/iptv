import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Commerce Platform", template: "%s | Commerce Platform" },
  description: "منصة متاجر إلكترونية متعددة المستأجرين",
};

// إعداد العرض للجوال: يمنع التكبير غير المقصود ويدعم شاشات النوتش (safe areas).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#004d73",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)] antialiased">{children}</body>
    </html>
  );
}
