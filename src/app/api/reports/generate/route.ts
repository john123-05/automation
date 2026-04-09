import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMonthlyReport } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  clientId: z.string().trim().min(1),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  preferredMailboxId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const report = await generateMonthlyReport({
      clientId: payload.clientId,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      preferredMailboxId: payload.preferredMailboxId ?? null,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
