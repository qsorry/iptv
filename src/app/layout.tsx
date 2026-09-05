import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPTV System",
  description: "نظام إدارة اشتراكات IPTV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
