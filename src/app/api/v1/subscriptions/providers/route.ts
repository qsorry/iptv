import { NextResponse, type NextRequest } from "next/server";
import { listProviders, createProvider } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** GET /api/v1/subscriptions/providers — مزوّدو الاشتراكات للمتجر (المفتاح مقنّع). */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    return NextResponse.json({ data: await listProviders(ctx) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/v1/subscriptions/providers — إضافة مزوّد { name, preset, baseUrl, apiKey, config? }. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    const body = await request.json();
    return NextResponse.json({ data: await createProvider(ctx, body) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
