import { NextResponse } from "next/server";
import { z } from "zod";
import { assignMailboxToCampaign } from "@/lib/sales-machine/campaigns";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  mailboxId: z.string().trim().min(1).nullable(),
});

export async function POST(request: Request, context: RouteContext<"/api/campaigns/[id]/assign-mailbox">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    await assignMailboxToCampaign(id, payload.mailboxId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
