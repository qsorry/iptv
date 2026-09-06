import { NextResponse, type NextRequest } from "next/server";
import { updateProvider, deleteProvider } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/v1/subscriptions/providers/:id */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { id } = await params;
    return NextResponse.json({ data: await updateProvider(ctx, id, await request.json()) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/v1/subscriptions/providers/:id */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { id } = await params;
    await deleteProvider(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
