import { NextResponse } from "next/server";
import { z } from "zod";
import { createReminder } from "@/lib/sales-machine/agency-os";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().min(2),
  dueAt: z.string().trim().min(1),
  leadId: z.string().trim().min(1).nullable().optional(),
  opportunityId: z.string().trim().min(1).nullable().optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
  projectId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function GET() {
  try {
    const snapshot = await getOutreachSnapshot();
    return NextResponse.json({ ok: true, reminders: snapshot.reminders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const reminder = await createReminder({
      title: payload.title,
      dueAt: payload.dueAt,
      leadId: payload.leadId ?? null,
      opportunityId: payload.opportunityId ?? null,
      clientId: payload.clientId ?? null,
      projectId: payload.projectId ?? null,
      notes: payload.notes ?? null,
    });

    return NextResponse.json({ ok: true, reminder });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
