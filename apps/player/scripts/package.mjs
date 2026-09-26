/**
 * حزم Ssouq Net لكل منصة من نفس dist/ (شغّل `npm run build` أولاً):
 *
 *   node scripts/package.mjs tizen    → release/tizen/ + release/SsouqNet-<v>-unsigned.wgt
 *   node scripts/package.mjs webos    → release/webos/ (+ ipk إن وُجد ares-package)
 *   node scripts/package.mjs android  → نسخ dist إلى غلاف Android ثم APK إن وُجد Android SDK
 *
 * الإصدار من package.json يُكتب في config.xml وappinfo.json وversionName.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const release = join(root, "release");
const platforms = join(root, "platforms");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const target = process.argv[2];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function has(cmd) {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

/** رقم إصدار صحيح متزايد لـ Android: 1.2.3 → 10203. */
function versionCode(v) {
  const [a = 0, b = 0, c = 0] = v.split(".").map((n) => parseInt(n, 10) || 0);
  return a * 10000 + b * 100 + c;
}

if (!existsSync(join(dist, "index.html"))) fail("لا يوجد dist/. شغّل npm run build أولاً.");
mkdirSync(release, { recursive: true });

if (target === "tizen") {
  const out = join(release, "tizen");
  rmSync(out, { recursive: true, force: true });
  cpSync(dist, out, { recursive: true });
  cpSync(join(platforms, "tizen", "icon.png"), join(out, "icon.png"));
  const config = readFileSync(join(platforms, "tizen", "config.xml"), "utf8").replace(/(<widget[^>]*\sversion=")[^"]*"/, `$1${version}"`);
  writeFileSync(join(out, "config.xml"), config);
  const wgt = join(release, `SsouqNet-${version}-unsigned.wgt`);
  rmSync(wgt, { force: true });
  if (has("zip")) execFileSync("zip", ["-qr", wgt, "."], { cwd: out });
  console.log(`✓ Tizen: ${out}`);
  if (existsSync(wgt)) console.log(`✓ حزمة غير موقّعة: ${wgt}`);
  console.log("  للتثبيت على التلفاز وقّعها بشهادة Samsung من Tizen Studio:");
  console.log(`  tizen package -t wgt -s <profile> -- ${out}`);
} else if (target === "webos") {
  const out = join(release, "webos");
  rmSync(out, { recursive: true, force: true });
  cpSync(dist, out, { recursive: true });
  for (const f of ["icon.png", "largeIcon.png"]) cpSync(join(platforms, "webos", f), join(out, f));
  const info = JSON.parse(readFileSync(join(platforms, "webos", "appinfo.json"), "utf8"));
  writeFileSync(join(out, "appinfo.json"), `${JSON.stringify({ ...info, version }, null, 2)}\n`);
  console.log(`✓ webOS: ${out}`);
  if (has("ares-package")) {
    execFileSync("ares-package", [out, "-o", release], { stdio: "inherit" });
  } else {
    console.log("  لإنشاء ipk: npm i -g @webos-tools/cli ثم:");
    console.log(`  ares-package ${out} -o ${release}`);
  }
} else if (target === "android") {
  const android = join(platforms, "android");
  const www = join(android, "app", "src", "main", "assets", "www");
  rmSync(www, { recursive: true, force: true });
  mkdirSync(dirname(www), { recursive: true });
  cpSync(dist, www, { recursive: true });
  console.log(`✓ نُسخت الواجهة إلى ${www}`);
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) {
    console.log("  لبناء APK: ثبّت Android SDK واضبط ANDROID_HOME ثم أعد التشغيل، أو افتح platforms/android في Android Studio.");
    process.exit(0);
  }
  const gradle = existsSync(join(android, "gradlew")) ? "./gradlew" : "gradle";
  const task = process.env.SSOUQ_KEYSTORE ? "assembleRelease" : "assembleDebug";
  execFileSync(gradle, [task, `-PappVersion=${version}`, `-PappVersionCode=${versionCode(version)}`, "--no-daemon", "-q"], { cwd: android, stdio: "inherit" });
  const apkDir = join(android, "app", "build", "outputs", "apk", task === "assembleRelease" ? "release" : "debug");
  const name = task === "assembleRelease" ? "app-release.apk" : "app-debug.apk";
  const apk = join(release, `SsouqNet-${version}${task === "assembleRelease" ? "" : "-debug"}.apk`);
  cpSync(join(apkDir, name), apk);
  console.log(`✓ APK: ${apk}`);
  console.log("  التثبيت على Android TV أو الجوال: adb install -r " + apk);
} else {
  fail("الاستخدام: node scripts/package.mjs tizen|webos|android");
}
