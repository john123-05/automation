import { NextResponse } from "next/server";
import { z } from "zod";
import { updateGeneratedSequenceStep } from "@/lib/sales-machine/outreach-workflows";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  sequenceId: z.string().trim().min(1),
  stepNumber: z.coerce.number().int().min(1).max(4),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await updateGeneratedSequenceStep({
      sequenceId: payload.sequenceId,
      stepNumber: payload.stepNumber as 1 | 2 | 3 | 4,
      subject: payload.subject,
      body: payload.body,
    });

    return NextResponse.json({
      ok: true,
      ...result,
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
