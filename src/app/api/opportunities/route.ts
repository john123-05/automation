import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertOpportunity } from "@/lib/sales-machine/agency-os";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  leadId: z.string().trim().min(1),
  contactId: z.string().trim().min(1).nullable().optional(),
  serviceKey: z.enum(["seo", "webdesign", "copywriting", "ai_automation", "marketing", "lead_capture"]),
  sourceCampaignId: z.string().trim().min(1).nullable().optional(),
  stage: z.enum(["new", "qualified", "meeting_booked", "proposal_drafted", "proposal_sent", "won", "lost", "nurture"]).nullable().optional(),
  status: z.enum(["open", "won", "lost", "nurture"]).nullable().optional(),
  estimatedValueUsd: z.number().nullable().optional(),
  closeProbability: z.number().nullable().optional(),
  nextStep: z.string().trim().nullable().optional(),
  nextStepDueAt: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function GET() {
  try {
    const snapshot = await getOutreachSnapshot();
    return NextResponse.json({ ok: true, opportunities: snapshot.opportunities });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const opportunity = await upsertOpportunity({
      leadId: payload.leadId,
      contactId: payload.contactId ?? null,
      serviceKey: payload.serviceKey,
      sourceCampaignId: payload.sourceCampaignId ?? null,
      stage: payload.stage ?? undefined,
      status: payload.status ?? undefined,
      estimatedValueUsd: payload.estimatedValueUsd ?? null,
      closeProbability: payload.closeProbability ?? null,
      nextStep: payload.nextStep ?? null,
      nextStepDueAt: payload.nextStepDueAt ?? null,
      notes: payload.notes ?? null,
    });

    return NextResponse.json({ ok: true, opportunity });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
