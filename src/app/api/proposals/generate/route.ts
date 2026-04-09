import { NextResponse } from "next/server";
import { z } from "zod";
import { generateProposal } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  opportunityId: z.string().trim().min(1),
  amountUsd: z.number().nullable().optional(),
  preferredMailboxId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await generateProposal({
      opportunityId: payload.opportunityId,
      amountUsd: payload.amountUsd ?? null,
      preferredMailboxId: payload.preferredMailboxId ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
