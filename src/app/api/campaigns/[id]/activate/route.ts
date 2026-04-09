import { NextResponse } from "next/server";
import { activateCampaign } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/campaigns/[id]/activate">) {
  try {
    const { id } = await context.params;
    await activateCampaign(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
