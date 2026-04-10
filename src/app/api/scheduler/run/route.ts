import { NextResponse } from "next/server";
import { listWarmupAccountsWithStatus } from "@/lib/email-warmup-server";
import { getEnv } from "@/lib/env";
import { runCampaignScheduler } from "@/lib/sales-machine/campaigns";
import { notifyServerIssue, notifyWarmupTrialExpiring } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

async function runInboxSync(origin: string) {
  const response = await fetch(new URL("/api/inbox/sync", origin), {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    ok: boolean;
    syncedThreads?: number;
    syncedMessages?: number;
    error?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Inbox sync failed.");
  }

  return payload;
}

function isAuthorized(request: Request) {
  const env = getEnv();

  if (!env.schedulerSecret) {
    return true;
  }

  const url = new URL(request.url);
  const providedSecret =
    request.headers.get("x-scheduler-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");

  return providedSecret === env.schedulerSecret;
}

async function notifyWarmupExpirations() {
  const accounts = await listWarmupAccountsWithStatus();
  const expiringAccounts = accounts.filter((account) => account.daysLeft === 1);

  if (!expiringAccounts.length) {
    return {
      notified: 0,
    };
  }

  await Promise.all(
    expiringAccounts.map((account) =>
      notifyWarmupTrialExpiring({
        email: account.email,
        trialEndsOn: account.trialEndsOn,
      }),
    ),
  );

  return {
    notified: expiringAccounts.length,
  };
}

async function handleScheduler(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(request.url);
    const origin = getEnv().appUrl?.replace(/\/+$/, "") || url.origin;
    const [schedulerResult, inboxResult, warmupResult] = await Promise.all([
      runCampaignScheduler(),
      runInboxSync(origin),
      notifyWarmupExpirations(),
    ]);

    return NextResponse.json({
      ok: true,
      ...schedulerResult,
      inboxSync: {
        syncedThreads: inboxResult.syncedThreads ?? 0,
        syncedMessages: inboxResult.syncedMessages ?? 0,
      },
      warmup: warmupResult,
    });
  } catch (error) {
    await notifyServerIssue({
      source: "api/scheduler/run",
      error,
    });

    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleScheduler(request);
}

export async function POST(request: Request) {
  return handleScheduler(request);
}
