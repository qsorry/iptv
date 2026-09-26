/**
 * تخزين محلي آمن: بعض التلفزيونات والوضع الخاص ترمي عند الوصول لـ localStorage،
 * فكل قراءة وكتابة داخل try/catch، والتطبيق يعمل (بلا حفظ) إن تعذّر التخزين.
 */
const PREFIX = "snp:";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // مساحة ممتلئة أو تخزين محجوب: نتجاهل ونكمل.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // لا شيء
  }
}
