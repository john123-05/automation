import { NextResponse } from "next/server";
import { z } from "zod";
import { createClientFromOpportunity } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  opportunityId: z.string().trim().min(1),
  startDate: z.string().trim().nullable().optional(),
  retainerType: z.enum(["one_off", "monthly", "quarterly", "project"]).nullable().optional(),
  billingCycle: z.string().trim().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const client = await createClientFromOpportunity({
      opportunityId: payload.opportunityId,
      startDate: payload.startDate ?? null,
      retainerType: payload.retainerType ?? undefined,
      billingCycle: payload.billingCycle ?? null,
    });

    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
