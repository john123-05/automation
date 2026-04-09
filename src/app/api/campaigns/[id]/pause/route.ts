import { NextResponse } from "next/server";
import { pauseCampaign } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/campaigns/[id]/pause">) {
  try {
    const { id } = await context.params;
    await pauseCampaign(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
