/**
 * تنسيق عربي بأرقام لاتينية وتقويم ميلادي، دون الاعتماد على Intl (بيانات اللغة ناقصة في بعض التلفزيونات).
 */

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** «21:05» بتوقيت الجهاز. */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «12 مارس 2027». */
export function date(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** «1:02:05» أو «12:05» لشريط التقدم. */
export function timecode(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** «2س 5د» أو «48د». */
export function shortDuration(secs: number): string {
  const total = Math.round(secs / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}د`;
  return m === 0 ? `${h}س` : `${h}س ${m}د`;
}

interface Forms {
  one: string;
  two: string;
  few: string;
  many: string;
}

/** قواعد العدد العربية: 1 دقيقة، 2 دقيقتان، 3–10 دقائق، 11+ دقيقة. */
export function count(n: number, f: Forms): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${n} ${f.few}`;
  return `${n} ${f.many}`;
}

export const MINUTES: Forms = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة" };
export const CHANNELS: Forms = { one: "قناة واحدة", two: "قناتان", few: "قنوات", many: "قناة" };
export const EPISODES: Forms = { one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقة" };
export const ITEMS: Forms = { one: "عنصر واحد", two: "عنصران", few: "عناصر", many: "عنصر" };
export const SEASONS: Forms = { one: "موسم واحد", two: "موسمان", few: "مواسم", many: "موسماً" };

/** «متبقٍّ 42 دقيقة». */
export function remaining(position: number, duration: number): string {
  const mins = Math.max(1, Math.round((duration - position) / 60));
  return `متبقٍّ ${count(mins, MINUTES)}`;
}

/** «10,291». */
export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** حروف عربية ولاتينية وأرقام (بلا \p{L} لأن تلفزيونات Chromium < 64 لا تدعمه). */
const WORD_CHAR = /[A-Za-z0-9\u0600-\u06FF\u0750-\u077F]/;
const NON_WORD = /[^A-Za-z0-9\u0600-\u06FF\u0750-\u077F\s]/g;

/** أول حرف ظاهر للاسم (لبطاقات بلا صورة). */
export function initial(name: string): string {
  const m = name.match(WORD_CHAR);
  return m ? m[0].toUpperCase() : "•";
}

/** اختصار لشعار القناة عند غياب الصورة: «رياضة 1 HD» → «ر1»، «أخبار 24» → «أ24». وسوم الجودة (HD, 4K…) لا تُحسب. */
export function logoText(name: string): string {
  const words = name
    .replace(NON_WORD, " ")
    .split(/\s+/)
    .filter((w) => w && !QUALITY.test(w));
  if (words.length === 0) return "TV";
  const number = words.find((w) => /^\d+$/.test(w));
  const first = words.find((w) => !/^\d+$/.test(w));
  if (number && first) return (first[0] + number).slice(0, 4).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const QUALITY = /^(HD|FHD|UHD|SD|HQ|4K|8K|HEVC|H265|RAW|VIP)$/i;
