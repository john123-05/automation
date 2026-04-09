import { NextResponse } from "next/server";
import { z } from "zod";
import { createCampaign } from "@/lib/sales-machine/campaigns";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  serviceKey: z.enum([
    "seo",
    "webdesign",
    "copywriting",
    "ai_automation",
    "marketing",
    "lead_capture",
  ]),
  sourceScope: z.enum(["run", "sheet", "all"]),
  sourceRunId: z.string().trim().min(1).nullable().optional(),
  sheetKey: z.string().trim().min(1).nullable().optional(),
  mailboxId: z.string().trim().min(1).nullable().optional(),
  timezone: z.string().trim().min(1).nullable().optional(),
});

export async function GET() {
  try {
    const snapshot = await getOutreachSnapshot();
    return NextResponse.json({
      ok: true,
      campaigns: snapshot.campaigns,
      metrics: snapshot.campaignMetrics,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    const campaignId = await createCampaign({
      name: payload.name ?? null,
      serviceKey: payload.serviceKey,
      sourceScope: payload.sourceScope,
      sourceRunId: payload.sourceRunId ?? null,
      sheetKey: payload.sheetKey ?? null,
      mailboxId: payload.mailboxId ?? null,
      timezone: payload.timezone ?? null,
    });

    return NextResponse.json({
      ok: true,
      campaignId,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
