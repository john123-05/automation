import { NextResponse } from "next/server";
import { z } from "zod";
import { runLeadSearch } from "@/lib/sales-machine/workflows";
import { notifyServerIssue } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const payloadSchema = z.object({
  niche: z.string().trim().min(2),
  location: z.string().trim().min(2),
  radiusMeters: z.number().int().min(100).max(50000),
  maxLeads: z.number().int().min(1).max(500),
  searchMode: z.enum(["capped", "exhaustive"]).default("capped"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const result = await runLeadSearch(payload);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      await notifyServerIssue({
        source: "api/leads/search",
        error,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
