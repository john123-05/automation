import { NextResponse } from "next/server";
import { z } from "zod";
import { createProjectTask } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().min(2),
  dueAt: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext<"/api/projects/[id]/tasks">) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const task = await createProjectTask({
      projectId: id,
      title: payload.title,
      dueAt: payload.dueAt ?? null,
      notes: payload.notes ?? null,
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
