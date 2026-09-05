import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Commerce Platform", template: "%s | Commerce Platform" },
  description: "منصة متاجر إلكترونية متعددة المستأجرين",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
