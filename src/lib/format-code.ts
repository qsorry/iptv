/**
 * يحوّل الكود المخزَّن للعرض: كل جزء مفصول بـ | يظهر في سطر مستقل.
 * مثال: "HOST:x|UserName:y|Password:z" → ["HOST:x","UserName:y","Password:z"]
 */
export function codeLines(code: string): string[] {
  return code.split("|").map((s) => s.trim()).filter(Boolean);
}
