import { NextResponse } from "next/server";
import { z } from "zod";
import { updateOpportunityStage } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  stage: z.enum(["new", "qualified", "meeting_booked", "proposal_drafted", "proposal_sent", "won", "lost", "nurture"]),
  status: z.enum(["open", "won", "lost", "nurture"]).nullable().optional(),
  nextStep: z.string().trim().nullable().optional(),
  nextStepDueAt: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext<"/api/opportunities/[id]/stage">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const opportunity = await updateOpportunityStage({
      opportunityId: id,
      stage: payload.stage,
      status: payload.status ?? undefined,
      nextStep: payload.nextStep ?? null,
      nextStepDueAt: payload.nextStepDueAt ?? null,
      notes: payload.notes ?? null,
    });

    return NextResponse.json({ ok: true, opportunity });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
