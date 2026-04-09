import { NextResponse } from "next/server";
import { z } from "zod";
import { updateOutreachState } from "@/lib/sales-machine/outreach-workflows";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  stateId: z.string().trim().min(1),
  state: z.enum([
    "drafted",
    "approved",
    "scheduled",
    "sent",
    "replied",
    "booked",
    "nurture",
    "closed",
    "needs_escalation",
    "no_show",
  ]),
  notes: z.string().trim().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    await updateOutreachState(payload);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
