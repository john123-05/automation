import { NextResponse } from "next/server";
import { z } from "zod";
import { addSuppressionEntry } from "@/lib/sales-machine/message-delivery";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().nullable().optional(),
  domain: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const entry = await addSuppressionEntry({
      email: payload.email ?? null,
      domain: payload.domain ?? null,
      reason: payload.reason,
      source: "manual",
    });

    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
