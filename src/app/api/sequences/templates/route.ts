import { NextResponse } from "next/server";
import { z } from "zod";
import { mutateDb } from "@/lib/sales-machine/store";
import { nowIso, serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().trim().min(1),
  subjectTemplate: z.string().trim().min(1),
  bodyTemplate: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    await mutateDb((db) => {
      const template = db.sequenceTemplates.find((candidate) => candidate.id === payload.id);

      if (!template) {
        throw new Error("Sequence template was not found.");
      }

      template.subjectTemplate = payload.subjectTemplate;
      template.bodyTemplate = payload.bodyTemplate;
      template.updatedAt = nowIso();
    });

    return NextResponse.json({
      ok: true,
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
