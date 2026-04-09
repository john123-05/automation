import { after, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { notifyServerIssue } from "@/lib/system-alerts";
import { handleTelegramUpdate } from "@/lib/telegram-bot";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const env = getEnv();

    if (!env.telegramBotToken || !env.telegramChatId) {
      return NextResponse.json({ ok: false, error: "Telegram is not configured." }, { status: 400 });
    }

    const update = (await request.json()) as Record<string, unknown>;

    after(async () => {
      await handleTelegramUpdate(update);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await notifyServerIssue({
      source: "api/telegram/webhook",
      error,
    });

    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
