import { NextResponse } from "next/server";
import { z } from "zod";
import { sendManualMessage, sendSequenceStep } from "@/lib/sales-machine/message-delivery";
import { notifyServerIssue } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const sequenceSchema = z.object({
  mode: z.literal("sequence"),
  sequenceId: z.string().trim().min(1),
  stepNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

const manualSchema = z.object({
  mode: z.literal("manual"),
  mailboxId: z.string().trim().min(1),
  threadId: z.string().trim().min(1).nullable().optional(),
  toEmail: z.string().email(),
  subject: z.string().trim().min(1),
  bodyText: z.string().trim().min(1),
});

const schema = z.union([sequenceSchema, manualSchema]);

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    if (payload.mode === "sequence") {
      const result = await sendSequenceStep(payload.sequenceId, payload.stepNumber);

      return NextResponse.json({
        ok: true,
        ...result,
      });
    }

    const result = await sendManualMessage({
      mailboxId: payload.mailboxId,
      threadId: payload.threadId ?? null,
      toEmail: payload.toEmail,
      subject: payload.subject,
      bodyText: payload.bodyText,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    await notifyServerIssue({
      source: "api/messages/send",
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
