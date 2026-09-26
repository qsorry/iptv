/** لوحات مفاتيح الجوال العربية تكتب أرقاماً مشرقية (٣٩٤)؛ خوادم IPTV تتوقع أرقاماً لاتينية. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** بحث بلا اعتبار للتشكيل وأشكال الهمزة والتاء المربوطة وحالة الأحرف. */
export function normalizeSearch(input: string): string {
  return toLatinDigits(input)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}
