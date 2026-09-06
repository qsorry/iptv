import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لتشغيلها داخل Docker (Coolify).
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // رفع ملفات الاستيراد (تصدير سلة) عبر Server Actions قد يتجاوز 1MB الافتراضي.
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
