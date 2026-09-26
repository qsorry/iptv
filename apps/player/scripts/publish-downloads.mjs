/**
 * ينشر حزم التطبيق للتنزيل من موقع المنصة: public/downloads/player/
 *   ssouq-net.apk        (Android وAndroid TV — يجب أن يكون موقّعاً بمفتاح الإصدار)
 *   ssouq-net-webos.ipk  (LG webOS — وضع المطوّر)
 *   manifest.json        (الإصدار والأحجام وSHA-256؛ تقرؤه لوحة المشغّل)
 *
 * الروابط ثابتة (بلا رقم إصدار) حتى تعمل روابط Downloader على التلفاز دائماً.
 * التشغيل بعد: npm run build && npm run package:android (بمفتاح الإصدار) && npm run package:webos
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(root, "release");
const out = join(root, "..", "..", "public", "downloads", "player");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const apk = join(release, `SsouqNet-${version}.apk`);
const ipk = readdirSync(release, { withFileTypes: true }).find((f) => f.isFile() && f.name.endsWith(`_${version}_all.ipk`));

if (!existsSync(apk)) {
  console.error(`✗ لا يوجد ${apk}. ابنِ نسخة موقّعة: SSOUQ_KEYSTORE=… npm run package:android (نسخة debug لا تُنشر لأن تحديثها لاحقاً يفشل).`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const files = {};

function publish(key, src, name, label) {
  const dest = join(out, name);
  copyFileSync(src, dest);
  files[key] = { file: name, label, bytes: statSync(dest).size, sha256: sha256(dest) };
  console.log(`✓ ${label}: /downloads/player/${name}`);
}

publish("android", apk, "ssouq-net.apk", "Android وAndroid TV");
if (ipk) publish("webos", join(release, ipk.name), "ssouq-net-webos.ipk", "LG webOS (وضع المطوّر)");
else console.log("  (لا توجد حزمة webOS لهذا الإصدار؛ تُتخطّى)");

writeFileSync(join(out, "manifest.json"), `${JSON.stringify({ version, publishedAt: new Date().toISOString(), files }, null, 2)}\n`);
console.log(`✓ manifest.json — الإصدار ${version}`);
