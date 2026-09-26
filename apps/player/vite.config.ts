import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import pkg from "./package.json" with { type: "json" };

/**
 * التطبيقات المحزومة على التلفاز تُفتح من file:// حيث يفشل تحميل سكربت يحمل crossorigin (فحص CORS لأصل null).
 * نحذف السمة من الصفحة ونجعل SystemJS يحمّل الأجزاء كسكربتات عادية بغض النظر عن أصل الصفحة.
 */
function fileProtocolSafe(): Plugin {
  const createScript = "System.constructor.prototype.createScript=function(u){var s=document.createElement('script');s.async=true;s.src=u;return s};";
  return {
    name: "ssouq-file-protocol-safe",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, "").replace("System.import(", `${createScript}System.import(`),
    },
  };
}

/**
 * البناء يُنتج حزمة «legacy» فقط (بلا <script type="module">) لأن تطبيقات Tizen وwebOS تُفتح من file://
 * حيث تُمنع وحدات ES، ولأن متصفحات تلفزيونات 2018+ قديمة (Chromium 53+). المسارات نسبية (base: "./").
 */
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    legacy({
      targets: ["chrome >= 53", "safari >= 12", "firefox >= 68"],
      renderModernChunks: false,
    }),
    fileProtocolSafe(),
  ],
  build: {
    outDir: "dist",
    // بلا هذا يحوّل المصغّر rgba() إلى hex بثمانية أرقام الذي لا يفهمه Chromium < 62.
    cssTarget: ["chrome53", "safari12"],
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
