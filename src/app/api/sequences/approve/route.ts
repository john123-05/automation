import { NextResponse } from "next/server";
import { z } from "zod";
import { approveGeneratedSequences } from "@/lib/sales-machine/outreach-workflows";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  sequenceIds: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const approved = await approveGeneratedSequences(payload);

    return NextResponse.json({
      ok: true,
      approved,
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
