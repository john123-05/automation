import { NextResponse } from "next/server";
import { z } from "zod";
import { updateProposalStatus } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["draft", "sent", "accepted", "lost"]),
});

export async function POST(request: Request, context: RouteContext<"/api/proposals/[id]/status">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const proposal = await updateProposalStatus({
      proposalId: id,
      status: payload.status,
    });

    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
