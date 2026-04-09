import { NextResponse } from "next/server";
import { z } from "zod";
import { createClientProject } from "@/lib/sales-machine/agency-os";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  clientId: z.string().trim().min(1),
  serviceKey: z.enum(["seo", "webdesign", "copywriting", "ai_automation", "marketing", "lead_capture"]),
  name: z.string().trim().min(2),
  startDate: z.string().trim().nullable().optional(),
  targetDate: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function GET() {
  try {
    const snapshot = await getOutreachSnapshot();
    return NextResponse.json({
      ok: true,
      projects: snapshot.clientProjects,
      tasks: snapshot.projectTasks,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const project = await createClientProject({
      clientId: payload.clientId,
      serviceKey: payload.serviceKey,
      name: payload.name,
      startDate: payload.startDate ?? null,
      targetDate: payload.targetDate ?? null,
      notes: payload.notes ?? null,
    });

    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
