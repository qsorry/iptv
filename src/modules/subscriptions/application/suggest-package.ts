/**
 * يقترح الباقة الأقرب لعنوان منتج من قائمة باقات المزوّد، ويستخرج المدة وعدد الأجهزة من العنوان.
 * خوارزمية بسيطة: تطبيع النص، استخراج المدة بالأشهر، ثم تسجيل نقاط للتطابق في المدة والكلمات المشتركة.
 */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[|\-_/،,.:()\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** يستخرج المدة بالأشهر من نص مثل "12 شهر"، "سنة"، "3 months"، "شهرين"، "6m". */
export function extractMonths(text: string): number | null {
  const t = normalizeText(text);
  // ملاحظة: \b في JS لا يعمل مع الحروف العربية؛ نستخدم حدوداً يدوية.
  const E = "(?![\\p{L}\\d])";
  // "1years + 3 months" → 15؛ "سنة و3 أشهر" → 15.
  const year = t.match(new RegExp(`(\\d+)\\s*(سنه|سنوات|سنين|year|years|yr|y)${E}`, "u"));
  const num = t.match(new RegExp(`(\\d+)\\s*(شهر|اشهر|شهور|month|months|mo|m)${E}`, "u"));
  if (year || num) return (year ? Number(year[1]) * 12 : 0) + (num ? Number(num[1]) : 0);
  const has = (alts: string) => new RegExp(`(?<![\\p{L}\\d])(${alts})${E}`, "u").test(t);
  if (has("سنتين|عامين|2y|24m")) return 24;
  if (has("سنه|سنوي|عام|year|yearly|annual|1y|12m")) return 12;
  if (has("نصف سنه|6m")) return 6;
  if (has("شهرين")) return 2;
  if (has("شهر|شهري|month|monthly|1m")) return 1;
  return null;
}

/** يستخرج عدد الأجهزة/الاتصالات من نص مثل "2 جهاز" أو "3 devices" أو "اتصالين". */
export function extractConnections(text: string): number | null {
  const t = normalizeText(text);
  const E = "(?![\\p{L}\\d])";
  const m = t.match(new RegExp(`(\\d+)\\s*(جهاز|اجهزه|شاشه|شاشات|اتصال|اتصالات|device|devices|screen|screens|connection|connections|conn|contact|contacts|user|users)${E}`, "u"));
  if (m) return Number(m[1]);
  if (new RegExp(`(?<![\\p{L}\\d])(جهازين|شاشتين|اتصالين)${E}`, "u").test(t)) return 2;
  return null;
}

const STOP = new Set(["اشتراك", "subscription", "iptv", "tv", "package", "باقه", "الباقه", "plan", "pro", "شهر", "اشهر", "month", "months", "جهاز", "اجهزه"]);

function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)));
}

export interface PackageLike {
  id: string;
  name: string;
}

export interface Suggestion<P extends PackageLike> {
  pkg: P | null;
  score: number;
  months: number | null;
  connections: number | null;
}

/** أفضل باقة لعنوان المنتج. score=0 يعني لا تطابق حقيقياً (تُعرض القائمة بلا اختيار مسبق). */
export function suggestPackage<P extends PackageLike>(title: string, packages: P[]): Suggestion<P> {
  const months = extractMonths(title);
  const connections = extractConnections(title);
  const titleTokens = tokens(title);

  let best: P | null = null;
  let bestScore = 0;
  for (const p of packages) {
    let score = 0;
    const pm = extractMonths(p.name);
    if (months != null && pm != null) score += pm === months ? 10 : -3;
    const pc = extractConnections(p.name);
    if (connections != null && pc != null) score += pc === connections ? 4 : -1;
    // العنوان لا يذكر أجهزة: فضّل الباقة الأبسط (بلا قيد أجهزة).
    if (connections == null && pc != null) score -= 1;
    for (const w of tokens(p.name)) if (titleTokens.has(w)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return { pkg: best, score: bestScore, months, connections };
}
