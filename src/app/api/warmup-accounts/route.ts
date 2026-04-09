import { NextResponse } from "next/server";
import { z } from "zod";
import { addWarmupAccount, listWarmupAccounts } from "@/lib/email-warmup";
import { notifyServerIssue } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const payloadSchema = z.object({
  email: z.string().trim().email(),
  trialEndsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      accounts: await listWarmupAccounts(),
    });
  } catch (error) {
    await notifyServerIssue({
      source: "api/warmup-accounts:get",
      error,
    });

    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const account = await addWarmupAccount(payload);

    return NextResponse.json({
      ok: true,
      account,
      accounts: await listWarmupAccounts(),
    });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      await notifyServerIssue({
        source: "api/warmup-accounts:post",
        error,
      });
    }

    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
