import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeeting } from "@/lib/sales-machine/agency-os";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  leadId: z.string().trim().min(1),
  opportunityId: z.string().trim().min(1).nullable().optional(),
  contactId: z.string().trim().min(1).nullable().optional(),
  scheduledAt: z.string().trim().min(1),
  durationMinutes: z.number().int().min(5).max(240),
  agenda: z.string().trim().nullable().optional(),
  prepNotes: z.string().trim().nullable().optional(),
  outcome: z.string().trim().nullable().optional(),
  followUpDueAt: z.string().trim().nullable().optional(),
  status: z.enum(["planned", "completed", "no_show", "cancelled"]).nullable().optional(),
});

export async function GET() {
  try {
    const snapshot = await getOutreachSnapshot();
    return NextResponse.json({ ok: true, meetings: snapshot.meetings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const meeting = await createMeeting({
      leadId: payload.leadId,
      opportunityId: payload.opportunityId ?? null,
      contactId: payload.contactId ?? null,
      scheduledAt: payload.scheduledAt,
      durationMinutes: payload.durationMinutes,
      agenda: payload.agenda ?? null,
      prepNotes: payload.prepNotes ?? null,
      outcome: payload.outcome ?? null,
      followUpDueAt: payload.followUpDueAt ?? null,
      status: payload.status ?? undefined,
    });

    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
