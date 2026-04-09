import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCampaignSchedule } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  timezone: z.string().trim().min(1),
  sendWindowStart: z.string().trim().regex(/^\d{2}:\d{2}$/),
  sendWindowEnd: z.string().trim().regex(/^\d{2}:\d{2}$/),
  allowedWeekdays: z.array(z.number().int().min(0).max(6)).min(1),
  stopOnReply: z.boolean(),
  waitHoursAfterFinalStep: z.number().int().min(1).max(336),
});

export async function POST(request: Request, context: RouteContext<"/api/campaigns/[id]/schedule">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());

    await updateCampaignSchedule({
      campaignId: id,
      timezone: payload.timezone,
      sendWindowStart: payload.sendWindowStart,
      sendWindowEnd: payload.sendWindowEnd,
      allowedWeekdays: payload.allowedWeekdays,
      stopOnReply: payload.stopOnReply,
      waitHoursAfterFinalStep: payload.waitHoursAfterFinalStep,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
