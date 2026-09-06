import * as XLSX from "xlsx";

/**
 * يحوّل ملف جدول (xlsx أو csv) إلى صفوف كائنات (المفتاح = عنوان العمود).
 * القيم نصية (raw:false) لتوحيد المعالجة. يقرأ أول ورقة فقط.
 */
export function parseSpreadsheet(buffer: ArrayBuffer | Uint8Array): Record<string, string>[] {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = v == null ? "" : String(v);
    return out;
  });
}
