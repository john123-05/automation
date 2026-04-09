import { NextResponse } from "next/server";
import { regenerateCampaign } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/campaigns/[id]/regenerate">) {
  try {
    const { id } = await context.params;
    const result = await regenerateCampaign(id);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
