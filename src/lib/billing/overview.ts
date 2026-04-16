import "server-only";
import { getAppTrackedClaudeSpend } from "@/lib/billing/anthropic-app";
import { getAppTrackedOpenAiSpend } from "@/lib/billing/openai-app";
import type { BillingCard, BillingOverview } from "@/lib/billing/types";
import { getGoogleCloudBillingSnapshot } from "@/lib/billing/google-cloud";
import { getOpenAiBillingSnapshot } from "@/lib/billing/openai";
import {
  calculateTrialEndDate,
  calculateDaysLeft,
  formatDateLabel,
  formatDaysLeft,
  formatMoney,
  parseTrialCreditUsd,
  parseTrialStartDate,
} from "@/lib/billing/utils";
import { getEnv } from "@/lib/env";
import type { WorkflowRun } from "@/lib/sales-machine/types";

function buildTrialCreditsCard({
  googleCloudBilling,
}: {
  googleCloudBilling: Awaited<ReturnType<typeof getGoogleCloudBillingSnapshot>>;
}): BillingCard {
  const env = getEnv();
  const trialStartDate = parseTrialStartDate(env.gcpTrialStartDate);
  const trialTotalCreditUsd = parseTrialCreditUsd(env.gcpTrialTotalCreditUsd);
  const now = new Date();
  const trialEndDate = trialStartDate
    ? calculateTrialEndDate({
        trialStartDate,
        trialLengthDays: env.gcpTrialLengthDays,
      })
    : null;
  const manualRemainingCredit = googleCloudBilling.manualRemainingCredit ?? null;
  const hasManualRemainingCredit = manualRemainingCredit !== null;
  const hasDerivedLiveCredit =
    trialTotalCreditUsd !== null && googleCloudBilling.trialCreditUsed !== null;
  const derivedRemainingCredit = hasDerivedLiveCredit
    ? Math.max(0, trialTotalCreditUsd - (googleCloudBilling.trialCreditUsed ?? 0))
    : null;

  if (!trialStartDate) {
    return {
      id: "trial-credits",
      title: "Trial Credits",
      titleSuffix: null,
      scopeLabel: "manual console tracking",
      status: "setup-needed",
      statusLabel: "Setup needed",
      summary: "",
      metrics: [
        {
          label: "Days left",
          value: "Not configured",
        },
        {
          label: "Used credit",
          value: "Not configured",
        },
        {
          label: "Remaining credit",
          value: "Not configured",
        },
      ],
      lastUpdatedAt: null,
    };
  }

  if (googleCloudBilling.error || googleCloudBilling.spendSinceTrialStart === null) {
    const usingManualFallback = googleCloudBilling.manualFallbackUsed;

    return {
      id: "trial-credits",
      title: "Trial Credits",
      titleSuffix: formatDateLabel(trialEndDate),
      scopeLabel: "manual console tracking",
      status:
        googleCloudBilling.pendingExportData || usingManualFallback ? "setup-needed" : "error",
      statusLabel: googleCloudBilling.pendingExportData
        ? usingManualFallback
          ? "Fallback"
          : "Waiting"
        : usingManualFallback
          ? "Console"
          : "Issue",
      summary: googleCloudBilling.pendingExportData
        ? usingManualFallback
          ? "Using the latest console credit value until BigQuery-derived credit tracking is trustworthy."
          : "Billing export is connected, but Google has not filled the table yet."
        : usingManualFallback
          ? "BigQuery is not available on this deployment right now, so the card is using your manual console values."
          : googleCloudBilling.error ?? "",
      metrics: [
        {
          label: "Days left",
          value: formatDaysLeft(
            calculateDaysLeft({
              trialStartDate,
              trialLengthDays: env.gcpTrialLengthDays,
              now,
            }),
          ),
        },
        {
          label: "Used credit",
          value:
            googleCloudBilling.trialCreditUsed === null
              ? googleCloudBilling.pendingExportData
                ? googleCloudBilling.manualFallbackUsed
                  ? "Manual fallback not set"
                  : "Waiting for export"
                : "Unavailable"
              : formatMoney(
                  googleCloudBilling.trialCreditUsed,
                  googleCloudBilling.currency,
                ),
        },
        {
          label: "Remaining credit",
          value: hasManualRemainingCredit
            ? formatMoney(manualRemainingCredit, googleCloudBilling.currency)
            : "Add console value",
        },
      ],
      lastUpdatedAt: googleCloudBilling.lastUpdatedAt,
    };
  }

  const daysLeft = calculateDaysLeft({
    trialStartDate,
    trialLengthDays: env.gcpTrialLengthDays,
    now,
  });

  return {
    id: "trial-credits",
    title: "Trial Credits",
    titleSuffix: formatDateLabel(trialEndDate),
    scopeLabel: hasDerivedLiveCredit ? "BigQuery-derived trial tracking" : "manual console tracking",
    status: "ready",
    statusLabel: hasDerivedLiveCredit ? "Live" : hasManualRemainingCredit ? "Console" : "Needs update",
    summary: hasDerivedLiveCredit
      ? "Used and remaining trial credits are derived live from BigQuery spend since the trial start date."
      : hasManualRemainingCredit
        ? "Remaining credit is shown from the latest Google Cloud console value."
        : "Add the latest remaining credit from the Google Cloud console to keep this card accurate.",
    metrics: [
      {
        label: "Days left",
        value: formatDaysLeft(daysLeft),
      },
      {
        label: "Used credit",
        value:
          googleCloudBilling.trialCreditUsed === null
            ? "Unavailable"
            : formatMoney(googleCloudBilling.trialCreditUsed, googleCloudBilling.currency),
      },
      {
        label: "Remaining credit",
        value: hasDerivedLiveCredit
          ? formatMoney(derivedRemainingCredit, googleCloudBilling.currency)
          : hasManualRemainingCredit
            ? formatMoney(manualRemainingCredit, googleCloudBilling.currency)
            : "Add console value",
      },
    ],
    lastUpdatedAt: googleCloudBilling.lastUpdatedAt,
    refreshPath: "/api/billing/google-cloud/refresh",
  };
}

function buildOpenAiCard({
  orgBilling,
  appSpend,
}: {
  orgBilling: Awaited<ReturnType<typeof getOpenAiBillingSnapshot>>;
  appSpend: ReturnType<typeof getAppTrackedOpenAiSpend>;
}): BillingCard {
  const useOrgFallback = !appSpend.lastUpdatedAt && !orgBilling.error;
  const status = orgBilling.error?.includes("OPENAI_ADMIN_KEY")
    ? "setup-needed"
    : orgBilling.error
      ? "error"
      : "ready";
  const noLiveOpenAiBilling = Boolean(orgBilling.error) && !appSpend.lastUpdatedAt;
  const setupNeeded = orgBilling.error?.includes("OPENAI_ADMIN_KEY");
  const metricCurrency = useOrgFallback ? orgBilling.currency : appSpend.currency;

  return {
    id: "openai",
    title: "OpenAI",
    titleSuffix: null,
    scopeLabel: useOrgFallback
      ? "Showing whole-organization costs until app run tracking starts."
      : "App-tracked from contact enrichment runs.",
    status,
    statusLabel: orgBilling.error ? (status === "setup-needed" ? "Setup needed" : "Issue") : "Live",
    summary: orgBilling.error
      ? setupNeeded
        ? "OPENAI_ADMIN_KEY is missing in the hosted environment, so organization-wide OpenAI costs cannot load."
        : orgBilling.error
      : useOrgFallback
        ? "New enrichment runs will switch this card over to app-tracked spend."
        : `Org month to date: ${formatMoney(orgBilling.monthToDateCost, orgBilling.currency)}.`,
    metrics: [
      {
        label: useOrgFallback ? "Month to date" : "App MTD",
        value: noLiveOpenAiBilling
          ? setupNeeded
            ? "Add admin key"
            : "Unavailable"
          : formatMoney(useOrgFallback ? orgBilling.monthToDateCost : appSpend.monthToDateCost, metricCurrency),
      },
      {
        label: useOrgFallback ? "Last 7 days" : "App 7 days",
        value: noLiveOpenAiBilling
          ? setupNeeded
            ? "Add admin key"
            : "Unavailable"
          : formatMoney(useOrgFallback ? orgBilling.last7DaysCost : appSpend.last7DaysCost, metricCurrency),
      },
    ],
    lastUpdatedAt: appSpend.lastUpdatedAt ?? orgBilling.lastUpdatedAt,
    refreshPath: null,
  };
}

function buildAnthropicCard({
  appSpend,
  anthropicApiKey,
}: {
  appSpend: ReturnType<typeof getAppTrackedClaudeSpend>;
  anthropicApiKey: string | null;
}): BillingCard {
  const hasKey = Boolean(anthropicApiKey);
  const hasData = Boolean(appSpend.lastUpdatedAt);

  return {
    id: "anthropic",
    title: "Anthropic",
    titleSuffix: null,
    scopeLabel: "App-tracked from Claude enrichment runs.",
    status: hasKey ? "ready" : "setup-needed",
    statusLabel: hasKey ? (hasData ? "Live" : "Ready") : "Setup needed",
    summary: hasKey
      ? hasData
        ? "Costs are tracked from contact enrichment runs that used Claude as a fallback provider."
        : "No Claude enrichment runs yet. Claude will be used automatically when higher-priority providers fail."
      : "Add ANTHROPIC_API_KEY to enable Claude as a last-resort fallback for contact enrichment.",
    metrics: [
      {
        label: "App MTD",
        value: hasKey ? formatMoney(appSpend.monthToDateCost, appSpend.currency) : "Add API key",
      },
      {
        label: "App 7 days",
        value: hasKey ? formatMoney(appSpend.last7DaysCost, appSpend.currency) : "Add API key",
      },
    ],
    lastUpdatedAt: appSpend.lastUpdatedAt,
    refreshPath: null,
  };
}

export async function getBillingOverview({
  runs = [],
}: {
  runs?: WorkflowRun[];
}): Promise<BillingOverview> {
  const [googleCloudBilling, openAiBilling] = await Promise.all([
    getGoogleCloudBillingSnapshot(),
    getOpenAiBillingSnapshot(),
  ]);
  const openAiAppSpend = getAppTrackedOpenAiSpend(runs);
  const claudeAppSpend = getAppTrackedClaudeSpend(runs);
  const env = getEnv();

  return {
    cards: [
      buildTrialCreditsCard({ googleCloudBilling }),
      buildOpenAiCard({
        orgBilling: openAiBilling,
        appSpend: openAiAppSpend,
      }),
      buildAnthropicCard({
        appSpend: claudeAppSpend,
        anthropicApiKey: env.anthropicApiKey,
      }),
    ],
  };
}
