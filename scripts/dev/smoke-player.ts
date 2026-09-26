/**
 * اختبار دخاني لخادم تطبيق المشغّل على قاعدة بيانات حقيقية:
 * خوادم المزوّد وبادئاتها، التعرّف بأطول بادئة، أكواد التفعيل (استبدال، انتهاء، إلغاء)،
 * وربط التلفاز بالجوال (تسليم مرة واحدة، رمز استطلاع، انتهاء الصلاحية).
 * التشغيل: DATABASE_URL=... BETTER_AUTH_SECRET=... npx tsx scripts/dev/smoke-player.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { auditLogs, playerActivationCodes, playerPairings } from "@/infrastructure/database/schema";
import { changeProviderStatus, createProvider, ensureDefaultRequirements, listRequirements, reviewSubmission, type Actor } from "@/modules/providers";
import {
  ACTIVATION_CODE_PATTERN,
  InvalidActivationCodeError,
  PAIRING_TTL_MS,
  completePairing,
  createActivationCode,
  createProviderServer,
  deleteProviderServer,
  detectServer,
  findPendingPairing,
  generateActivationCode,
  listActivationCodes,
  listProviderServers,
  normalizeActivationCode,
  normalizePairingCode,
  normalizeServerUrl,
  parsePrefixes,
  pollPairing,
  redeemActivationCode,
  revokeActivationCode,
  startPairing,
  updateProviderServer,
} from "@/modules/player";
import { ConflictError, InvalidStateTransitionError, NotFoundError, ValidationError } from "@/core/errors";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`✓ ${msg}`);
};

async function rejects(fn: () => Promise<unknown>, type: new (...args: never[]) => Error, msg: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof type, `${msg} (${(e as Error).message})`);
    return;
  }
  throw new Error(`FAILED: ${msg} — لم يُرمَ خطأ`);
}

const DAY = 24 * 60 * 60 * 1000;
const actor: Actor = { userId: null, email: "smoke@test" };
/** بادئات فريدة لكل تشغيل حتى يُعاد الاختبار على نفس القاعدة. */
const run = String(Date.now()).slice(-6);

async function approvedProvider(name: string) {
  await ensureDefaultRequirements();
  const provider = await createProvider({ name }, actor);
  await changeProviderStatus(provider.id, { to: "under_review" }, actor);
  const expiry = new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10);
  for (const req of (await listRequirements({ activeOnly: true })).filter((r) => r.isRequired)) {
    await reviewSubmission(provider.id, req.id, { status: "accepted", expiresAt: req.hasExpiry ? expiry : "" }, actor);
  }
  return provider;
}

async function main() {
  // ── الدوال النقية ──
  assert(ACTIVATION_CODE_PATTERN.test(generateActivationCode()), "الكود المولّد بصيغة SN-XXXX-XXXX");
  assert(normalizeActivationCode(" sn 8h3k 92pl ") === "SN-8H3K-92PL" && normalizeActivationCode("8H3K92PL") === "SN-8H3K-92PL", "تطبيع الكود من كتابة المستخدم");
  assert(normalizeActivationCode("SN-123") === null, "الكود الناقص مرفوض");
  assert(normalizePairingCode("abcd efgh") === "ABCD-EFGH", "تطبيع رمز الربط");
  assert(normalizeServerUrl("host.tv:8080/player_api.php?username=a") === "http://host.tv:8080", "رابط الخادم يُختصر إلى الأصل");
  assert(JSON.stringify(parsePrefixes("٣٩٤، 512 512 ABC")) === JSON.stringify(["394", "512", "abc"]), "البادئات تُطبَّع (أرقام عربية، مكرر، حروف كبيرة)");

  // ── الخوادم والبادئات ──
  const provider = await approvedProvider(`مزوّد المشغّل ${run}`);
  const p1 = `9${run}`;
  const p2 = `9${run}7`;
  const serverA = await createProviderServer(provider.id, { label: "الخادم A", baseUrl: "http://a.example:8080/", prefixes: `${p1}` }, actor);
  const serverB = await createProviderServer(provider.id, { label: "الخادم B", baseUrl: "https://b.example", prefixes: [p2] }, actor);
  assert(serverA.baseUrl === "http://a.example:8080", "الخادم يُحفظ بأصل مطبّع");
  await rejects(() => createProviderServer(provider.id, { label: "مكرر", baseUrl: "http://c.example", prefixes: p1 }, actor), ConflictError, "البادئة المستخدمة مرفوضة");
  await rejects(() => createProviderServer(provider.id, { label: "سيئ", baseUrl: "ftp://c.example", prefixes: `8${run}` }, actor), ValidationError, "رابط غير http مرفوض");
  await rejects(() => createProviderServer(provider.id, { label: "بلا بادئة", baseUrl: "http://c.example", prefixes: " " }, actor), ValidationError, "الخادم بلا بادئة مرفوض");

  assert((await detectServer(`${p2}123`)) === null, "لا تعرّف قبل قبول المزوّد");
  await changeProviderStatus(provider.id, { to: "approved" }, actor);
  let found = await detectServer(`${p2}123`);
  assert(found?.server.id === serverB.id && found.provider.name === provider.name, "أطول بادئة تحدد الخادم");
  found = await detectServer(`${p1}555`);
  assert(found?.server.id === serverA.id && found.server.url === "http://a.example:8080", "البادئة الأقصر لخادم آخر");
  const arabic = `${p1}1`.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  assert((await detectServer(arabic))?.server.id === serverA.id, "التعرّف يعمل مع الأرقام العربية");
  assert((await detectServer("0000000")) === null, "اسم مستخدم بلا بادئة معروفة");

  await updateProviderServer(serverB.id, { label: "الخادم B", baseUrl: "https://b.example", prefixes: [p2], isActive: false }, actor);
  assert((await detectServer(`${p2}123`))?.server.id === serverA.id, "الخادم المعطّل لا يُستخدم ويرجع للبادئة الأقصر");
  const servers = await listProviderServers(provider.id);
  assert(servers.length === 2 && servers.find((s) => s.id === serverA.id)?.prefixes[0] === p1, "قائمة الخوادم مع بادئاتها");

  // ── أكواد التفعيل ──
  const code = await createActivationCode({ serverId: serverA.id, username: `${p1}0001`, password: "s3cret-pass", note: "" }, actor);
  assert(ACTIVATION_CODE_PATTERN.test(code.code) && code.passwordEncrypted !== "s3cret-pass", "الكود يُصدر وكلمة المرور مشفّرة");
  const account = await redeemActivationCode(code.code.toLowerCase().replace(/-/g, " "));
  assert(account.username === `${p1}0001` && account.password === "s3cret-pass" && account.server.url === "http://a.example:8080", "الكود يُستبدل ببيانات الحساب");
  await redeemActivationCode(code.code);
  const [stored] = await db.select().from(playerActivationCodes).where(eq(playerActivationCodes.id, code.id));
  assert(stored.redemptionCount === 2 && stored.lastRedeemedAt, "الاستبدال يتكرر ويُعدّ (جوال + تلفاز)");
  await rejects(() => redeemActivationCode("SN-AAAA-AAAA"), InvalidActivationCodeError, "كود غير موجود مرفوض");
  await rejects(() => createActivationCode({ serverId: serverA.id, username: "u", password: "p", expiresAt: new Date(Date.now() - DAY).toISOString() }, actor), ValidationError, "كود بتاريخ منتهٍ مرفوض");

  const expiring = await createActivationCode({ serverId: serverA.id, username: "u2", password: "p2", expiresAt: new Date(Date.now() + DAY).toISOString() }, actor);
  await rejects(() => redeemActivationCode(expiring.code, new Date(Date.now() + 2 * DAY)), InvalidActivationCodeError, "الكود المنتهي مرفوض");

  await revokeActivationCode(code.id, actor);
  await rejects(() => redeemActivationCode(code.code), InvalidActivationCodeError, "الكود الملغى مرفوض");
  await rejects(() => revokeActivationCode(code.id, actor), InvalidStateTransitionError, "لا إلغاء مرتين");
  const listed = await listActivationCodes(provider.id);
  assert(listed.length === 2 && listed.every((c) => !("passwordEncrypted" in c)), "قائمة الأكواد بلا كلمات مرور");

  // ── ربط التلفاز ──
  const pairing = await startPairing();
  assert(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(pairing.code) && pairing.pairUrl.includes(encodeURIComponent(pairing.code)), "التلفاز يحصل على رمز ورابط QR");
  assert((await pollPairing(pairing.id, pairing.pollToken)).status === "pending", "الاستطلاع قبل الإرسال: pending");
  await rejects(() => pollPairing(pairing.id, "wrong-token"), NotFoundError, "رمز استطلاع خاطئ مرفوض");
  await rejects(() => pollPairing("not-a-uuid", pairing.pollToken), NotFoundError, "معرّف غير صالح مرفوض");
  assert((await findPendingPairing(pairing.code.toLowerCase())) !== null, "صفحة الجوال تجد الطلب");
  await rejects(() => completePairing({ pairCode: pairing.code, username: "0000000", password: "x" }), ValidationError, "اسم مستخدم بلا مزوّد معروف مرفوض");
  await rejects(() => completePairing({ pairCode: pairing.code }), ValidationError, "لا إرسال بلا كود أو بيانات");

  const sent = await completePairing({ pairCode: pairing.code.replace("-", ""), username: `${p1}0002`, password: "tv-pass" });
  assert(sent.serverLabel === "الخادم A", "الجوال يرسل الحساب بعد التعرّف على الخادم");
  await rejects(() => completePairing({ pairCode: pairing.code, username: `${p1}0002`, password: "x" }), ValidationError, "لا إكمال للطلب مرتين");
  const got = await pollPairing(pairing.id, pairing.pollToken);
  assert(got.status === "completed" && got.account.password === "tv-pass" && got.account.server.url === "http://a.example:8080", "التلفاز يستلم الحساب");
  assert((await pollPairing(pairing.id, pairing.pollToken)).status === "consumed", "الحساب يُسلَّم مرة واحدة فقط");
  const [row] = await db.select().from(playerPairings).where(eq(playerPairings.id, pairing.id));
  assert(row.payloadEncrypted === null, "الحمولة تُمسح بعد التسليم");

  const byCode = await startPairing();
  const fresh = await createActivationCode({ serverId: serverA.id, username: "u3", password: "p3" }, actor);
  await completePairing({ pairCode: byCode.code, activationCode: fresh.code });
  const viaCode = await pollPairing(byCode.id, byCode.pollToken);
  assert(viaCode.status === "completed" && viaCode.account.username === "u3", "الربط بكود التفعيل");

  const late = await startPairing();
  const after = new Date(Date.now() + PAIRING_TTL_MS + 1000);
  await rejects(() => completePairing({ pairCode: late.code, activationCode: fresh.code }, after), ValidationError, "لا إكمال بعد انتهاء الرمز");
  assert((await pollPairing(late.id, late.pollToken, after)).status === "expired", "الرمز ينتهي بعد مدته");

  // ── إيقاف المزوّد يوقف التطبيق ──
  await changeProviderStatus(provider.id, { to: "suspended", reason: "اختبار" }, actor);
  assert((await detectServer(`${p1}555`)) === null, "المزوّد الموقوف لا يُتعرّف عليه");
  await rejects(() => redeemActivationCode(fresh.code), InvalidActivationCodeError, "أكواد المزوّد الموقوف لا تعمل");

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, provider.id));
  assert(["player.server_created", "player.server_updated", "player.code_created", "player.code_revoked"].every((a) => logs.some((l) => l.action === a)), "إدارة الخوادم والأكواد مسجّلة في سجل المزوّد");

  await deleteProviderServer(serverA.id, actor);
  const [gone] = await db.select().from(playerActivationCodes).where(eq(playerActivationCodes.id, fresh.id));
  assert(!gone, "حذف الخادم يحذف أكواده");

  console.log("\nكل اختبارات خادم المشغّل نجحت");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
