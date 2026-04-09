import { NextResponse } from "next/server";
import { approveCampaign } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/campaigns/[id]/approve">) {
  try {
    const { id } = await context.params;
    const approved = await approveCampaign(id);

    return NextResponse.json({
      ok: true,
      approved,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
