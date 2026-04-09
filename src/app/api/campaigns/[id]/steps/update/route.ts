import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCampaignStep } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  stepNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  subjectTemplate: z.string().trim().min(1),
  bodyTemplate: z.string().trim().min(1),
  dayOffset: z.number().int().min(0).max(30),
  enabled: z.boolean(),
});

export async function POST(request: Request, context: RouteContext<"/api/campaigns/[id]/steps/update">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());

    await updateCampaignStep({
      campaignId: id,
      stepNumber: payload.stepNumber,
      subjectTemplate: payload.subjectTemplate,
      bodyTemplate: payload.bodyTemplate,
      dayOffset: payload.dayOffset,
      enabled: payload.enabled,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
