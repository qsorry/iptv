import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لتشغيلها داخل Docker (Coolify).
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
