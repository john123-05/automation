import { NextResponse } from "next/server";
import { z } from "zod";
import { runContactEnrichment } from "@/lib/sales-machine/workflows";
import { notifyServerIssue } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const payloadSchema = z.object({
  batchSize: z.number().int().min(1).max(50),
  includePreviouslyFailed: z.boolean().default(false),
  allowOpenAiSecondPass: z.boolean().default(false),
  scope: z.enum(["run", "all-pending"]).default("run"),
  sourceRunId: z.string().trim().min(1).nullable().default(null),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const result = await runContactEnrichment(payload);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      await notifyServerIssue({
        source: "api/leads/enrich",
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
