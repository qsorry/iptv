import type { Metadata, Viewport } from "next";
import "@/design-system/fonts.css";
import "@/design-system/foundation.css";
import "@/design-system/semantic.css";
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
  themeColor: "#2563EB",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-page text-ink antialiased">{children}</body>
    </html>
  );
}
