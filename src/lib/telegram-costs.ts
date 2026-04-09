import { getOpenAiBillingSnapshot } from "@/lib/billing/openai";
import { getAppTrackedOpenAiSpend } from "@/lib/billing/openai-app";
import { refreshGoogleCloudBillingSnapshot } from "@/lib/billing/google-cloud";
import {
  calculateDaysLeft,
  formatDaysLeft,
  formatMoney,
  parseTrialCreditUsd,
  parseTrialStartDate,
} from "@/lib/billing/utils";
import { getEnv } from "@/lib/env";
import { readDb } from "@/lib/sales-machine/store";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function looksLikeCostsRequest(message: string) {
  return /\b(kosten|cost|costs|billing|ausgaben|spend)\b/i.test(message);
}

export function looksLikeOpenAiCostsRequest(message: string) {
  return /\b(openai|open ai)\b/i.test(message) && looksLikeCostsRequest(message);
}

export function looksLikeAllCostsRequest(message: string) {
  const normalized = normalizeWhitespace(message.toLowerCase());

  return (
    looksLikeCostsRequest(normalized) &&
    !/\b(openai|open ai|trial|credit|credits|guthaben|google cloud)\b/.test(normalized)
  );
}

export async function getTelegramOpenAiCostsReply() {
  const [orgBilling, db] = await Promise.all([getOpenAiBillingSnapshot(), readDb()]);
  const appSpend = getAppTrackedOpenAiSpend(db.runs);

  return [
    "OpenAI Kosten",
    "",
    `Org MTD: ${formatMoney(orgBilling.monthToDateCost, orgBilling.currency)}`,
    `Org 7 Tage: ${formatMoney(orgBilling.last7DaysCost, orgBilling.currency)}`,
    `App MTD: ${formatMoney(appSpend.monthToDateCost, appSpend.currency)}`,
    `App 7 Tage: ${formatMoney(appSpend.last7DaysCost, appSpend.currency)}`,
    orgBilling.lastUpdatedAt ? `Updated: ${orgBilling.lastUpdatedAt}` : null,
    orgBilling.error ? `Hinweis: ${orgBilling.error}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function getTelegramAllCostsReply() {
  const env = getEnv();
  const [trialSnapshot, orgBilling, db] = await Promise.all([
    refreshGoogleCloudBillingSnapshot({ suppressAlerts: true }),
    getOpenAiBillingSnapshot(),
    readDb(),
  ]);
  const appSpend = getAppTrackedOpenAiSpend(db.runs);
  const trialStartDate = parseTrialStartDate(env.gcpTrialStartDate);
  const daysLeft = trialStartDate
    ? calculateDaysLeft({
        trialStartDate,
        trialLengthDays: env.gcpTrialLengthDays,
        now: new Date(),
      })
    : null;
  const trialTotalCredit = parseTrialCreditUsd(env.gcpTrialTotalCreditUsd);
  const usedCredit = trialSnapshot.trialCreditUsed ?? trialSnapshot.spendSinceTrialStart;
  const remainingCredit =
    trialTotalCredit !== null && usedCredit !== null
      ? Math.max(0, trialTotalCredit - usedCredit)
      : trialSnapshot.manualRemainingCredit ?? null;

  return [
    "Kosten Übersicht",
    "",
    "Trial Credits",
    `Days left: ${formatDaysLeft(daysLeft)}`,
    `Used credit: ${formatMoney(usedCredit, trialSnapshot.currency)}`,
    `Remaining credit: ${formatMoney(remainingCredit, trialSnapshot.currency)}`,
    "",
    "OpenAI",
    `Org MTD: ${formatMoney(orgBilling.monthToDateCost, orgBilling.currency)}`,
    `Org 7 Tage: ${formatMoney(orgBilling.last7DaysCost, orgBilling.currency)}`,
    `App MTD: ${formatMoney(appSpend.monthToDateCost, appSpend.currency)}`,
    `App 7 Tage: ${formatMoney(appSpend.last7DaysCost, appSpend.currency)}`,
  ].join("\n");
}
