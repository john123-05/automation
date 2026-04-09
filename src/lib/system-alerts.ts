import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GoogleBillingSnapshot } from "@/lib/billing/types";
import {
  calculateDaysLeft,
  formatDaysLeft,
  formatMoney,
  parseTrialCreditUsd,
  parseTrialStartDate,
} from "@/lib/billing/utils";
import { getEnv } from "@/lib/env";
import { serializeError } from "@/lib/sales-machine/utils";
import { sendTelegramSystemAlert } from "@/lib/telegram";

const ALERT_CACHE_DIR = path.join(process.cwd(), ".data");
const ALERT_CACHE_PATH = path.join(ALERT_CACHE_DIR, "telegram-alert-throttle.json");
const SERVER_ALERT_TTL_MS = 10 * 60 * 1000;
const BILLING_ALERT_TTL_MS = 60 * 60 * 1000;

type AlertCache = Record<string, string>;

function isEphemeralHostedRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
}

async function readAlertCache(): Promise<AlertCache> {
  if (isEphemeralHostedRuntime()) {
    return {};
  }

  try {
    const raw = await readFile(ALERT_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AlertCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAlertCache(cache: AlertCache) {
  if (isEphemeralHostedRuntime()) {
    return;
  }

  await mkdir(ALERT_CACHE_DIR, { recursive: true });
  await writeFile(ALERT_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function shouldSendAlert(key: string, ttlMs: number) {
  const cache = await readAlertCache();
  const lastSentAt = cache[key] ? new Date(cache[key]).getTime() : 0;

  if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < ttlMs) {
    return false;
  }

  cache[key] = new Date().toISOString();
  await writeAlertCache(cache);
  return true;
}

function hashAlertKey(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

export async function notifyServerIssue(input: {
  source: string;
  error: unknown;
  details?: string[];
}) {
  const message = serializeError(input.error);
  const fingerprint = hashAlertKey(`${input.source}:${message}`);

  if (!(await shouldSendAlert(`server:${fingerprint}`, SERVER_ALERT_TTL_MS))) {
    return;
  }

  try {
    await sendTelegramSystemAlert({
      title: "Server issue",
      lines: [
        `Source: ${input.source}`,
        `Error: ${message}`,
        ...(input.details ?? []),
      ],
    });
  } catch (alertError) {
    console.error("Failed to send server issue alert.", alertError);
  }
}

export async function notifyTrialCreditsUpdated(snapshot: GoogleBillingSnapshot) {
  const env = getEnv();
  const trialStartDate = parseTrialStartDate(env.gcpTrialStartDate);
  const daysLeft = trialStartDate
    ? calculateDaysLeft({
        trialStartDate,
        trialLengthDays: env.gcpTrialLengthDays,
        now: new Date(),
      })
    : null;
  const trialTotalCredit = parseTrialCreditUsd(env.gcpTrialTotalCreditUsd);
  const usedCredit = snapshot.trialCreditUsed ?? snapshot.spendSinceTrialStart;
  const remainingCredit =
    trialTotalCredit !== null && usedCredit !== null
      ? Math.max(0, trialTotalCredit - usedCredit)
      : snapshot.manualRemainingCredit ?? null;
  const key = hashAlertKey(
    JSON.stringify({
      day: new Date().toISOString().slice(0, 13),
      daysLeft,
      usedCredit,
      remainingCredit,
      currency: snapshot.currency,
      error: snapshot.error,
    }),
  );

  if (!(await shouldSendAlert(`billing:${key}`, BILLING_ALERT_TTL_MS))) {
    return;
  }

  try {
    await sendTelegramSystemAlert({
      title: "Trial credits updated",
      lines: [
        `Days left: ${formatDaysLeft(daysLeft)}`,
        `Used credit: ${formatMoney(usedCredit, snapshot.currency)}`,
        `Remaining credit: ${formatMoney(remainingCredit, snapshot.currency)}`,
      ],
    });
  } catch (alertError) {
    console.error("Failed to send billing update alert.", alertError);
  }
}

export async function notifyWarmupTrialExpiring(input: {
  email: string;
  trialEndsOn: string;
}) {
  const key = hashAlertKey(`warmup:${input.email}:${input.trialEndsOn}`);

  if (!(await shouldSendAlert(`warmup:${key}`, 30 * 60 * 60 * 1000))) {
    return;
  }

  try {
    await sendTelegramSystemAlert({
      title: "Instantly trial expiring soon",
      lines: [
        `Account: ${input.email}`,
        "This Instantly email address expires in 1 day.",
        `Trial end: ${input.trialEndsOn}`,
        "Remove or replace this address in Instantly soon.",
      ],
    });
  } catch (alertError) {
    console.error("Failed to send warmup expiration alert.", alertError);
  }
}
