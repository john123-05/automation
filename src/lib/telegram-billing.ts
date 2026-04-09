import { refreshGoogleCloudBillingSnapshot } from "@/lib/billing/google-cloud";
import {
  calculateDaysLeft,
  formatDaysLeft,
  formatMoney,
  parseTrialCreditUsd,
  parseTrialStartDate,
} from "@/lib/billing/utils";
import { getEnv } from "@/lib/env";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function looksLikeCreditRequest(message: string) {
  const normalized = normalizeWhitespace(message.toLowerCase());

  return /\b(credit|credits|trial credit|trial credits|guthaben|trial|bigquery|google cloud)\b/.test(
    normalized,
  );
}

export async function getTelegramCreditReply() {
  const env = getEnv();
  const snapshot = await refreshGoogleCloudBillingSnapshot({ suppressAlerts: true });
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

  if (snapshot.error) {
    return [
      "Ich konnte die Trial Credits gerade nicht sauber aktualisieren.",
      "",
      `Fehler: ${snapshot.error}`,
    ].join("\n");
  }

  return [
    "Trial Credits aktualisiert.",
    "",
    `Days left: ${formatDaysLeft(daysLeft)}`,
    `Used credit: ${formatMoney(usedCredit, snapshot.currency)}`,
    `Remaining credit: ${formatMoney(remainingCredit, snapshot.currency)}`,
    snapshot.lastUpdatedAt ? `Updated: ${snapshot.lastUpdatedAt}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
