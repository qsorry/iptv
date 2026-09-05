/**
 * التعامل مع المال بالوحدات الصغرى (هللة) كأعداد صحيحة لتجنب أخطاء الفاصلة العشرية.
 * قاعدة البيانات تخزن numeric(12,2) كنص؛ هذه الدوال تحوّل في الاتجاهين.
 */
export type Minor = number; // هللة

export const toMinor = (decimal: string | number): Minor => Math.round(Number(decimal) * 100);
export const toDecimal = (minor: Minor): string => (minor / 100).toFixed(2);

export const sum = (...values: Minor[]): Minor => values.reduce((a, b) => a + b, 0);
export const multiply = (unit: Minor, qty: number): Minor => Math.round(unit * qty);

/** نسبة مئوية مع تقريب (مناسب لضريبة القيمة المضافة 15%). */
export const percentOf = (amount: Minor, percent: number): Minor => Math.round((amount * percent) / 100);

export function formatMoney(minor: Minor, currency = "SAR", locale = "ar-SA") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}
