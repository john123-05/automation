import { NextResponse } from "next/server";
import { z } from "zod";
import { runWebsiteAudit } from "@/lib/sales-machine/outreach-workflows";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  serviceKey: z.enum([
    "seo",
    "webdesign",
    "copywriting",
    "ai_automation",
    "marketing",
    "lead_capture",
  ]),
  scope: z.enum(["run", "sheet", "all"]),
  sourceRunId: z.string().trim().min(1).nullable().optional(),
  sheetKey: z.string().trim().min(1).nullable().optional(),
  batchSize: z.number().int().min(1).max(100),
  campaignId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await runWebsiteAudit({
      serviceKey: payload.serviceKey,
      scope: payload.scope,
      sourceRunId: payload.sourceRunId ?? null,
      sheetKey: payload.sheetKey ?? null,
      batchSize: payload.batchSize,
      campaignId: payload.campaignId ?? null,
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
