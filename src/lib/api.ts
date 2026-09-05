import { NextResponse } from "next/server";
import { AppError } from "@/core/errors";

/** يحوّل أخطاء التطبيق إلى استجابة HTTP موحدة. */
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "خطأ غير متوقع" } }, { status: 500 });
}
