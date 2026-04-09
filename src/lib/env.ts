import type { ProviderStatus } from "@/lib/sales-machine/types";
import { readSetupVaultSync } from "@/lib/setup-vault";

export function getEnv() {
  const setupVault = readSetupVaultSync();
  const pick = (key: keyof typeof setupVault, fallback?: string | null) =>
    setupVault[key]?.trim() || fallback?.trim() || null;

  return {
    googleMapsApiKey: pick("GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY),
    openAiApiKey: pick("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    openAiAdminKey: pick("OPENAI_ADMIN_KEY", process.env.OPENAI_ADMIN_KEY),
    openAiModel: pick("OPENAI_MODEL", process.env.OPENAI_MODEL) || "gpt-5-mini",
    geminiApiKey: pick("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
    geminiModel: pick("GEMINI_MODEL", process.env.GEMINI_MODEL) || "gemini-2.5-flash",
    supabaseUrl: pick("SUPABASE_URL", process.env.SUPABASE_URL),
    supabaseServiceRoleKey: pick(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    gcpBigQueryServiceAccountJson: pick(
      "GCP_BIGQUERY_SERVICE_ACCOUNT_JSON",
      process.env.GCP_BIGQUERY_SERVICE_ACCOUNT_JSON,
    ),
    gcpBillingExportProjectId: pick(
      "GCP_BILLING_EXPORT_PROJECT_ID",
      process.env.GCP_BILLING_EXPORT_PROJECT_ID,
    ),
    gcpBillingExportDataset: pick(
      "GCP_BILLING_EXPORT_DATASET",
      process.env.GCP_BILLING_EXPORT_DATASET,
    ),
    gcpBillingExportTable: pick(
      "GCP_BILLING_EXPORT_TABLE",
      process.env.GCP_BILLING_EXPORT_TABLE,
    ),
    gcpBillingManualCurrency: pick(
      "GCP_BILLING_MANUAL_CURRENCY",
      process.env.GCP_BILLING_MANUAL_CURRENCY,
    ),
    gcpBillingManualMonthToDateCost: pick(
      "GCP_BILLING_MANUAL_MONTH_TO_DATE_COST",
      process.env.GCP_BILLING_MANUAL_MONTH_TO_DATE_COST,
    ),
    gcpBillingManualSpendSinceTrialStart: pick(
      "GCP_BILLING_MANUAL_SPEND_SINCE_TRIAL_START",
      process.env.GCP_BILLING_MANUAL_SPEND_SINCE_TRIAL_START,
    ),
    gcpBillingManualRemainingCredit: pick(
      "GCP_BILLING_MANUAL_REMAINING_CREDIT",
      process.env.GCP_BILLING_MANUAL_REMAINING_CREDIT,
    ),
    gcpTrialStartDate: pick("GCP_TRIAL_START_DATE", process.env.GCP_TRIAL_START_DATE),
    gcpTrialLengthDays: Number.parseInt(process.env.GCP_TRIAL_LENGTH_DAYS ?? "90", 10) || 90,
    gcpTrialTotalCreditUsd: pick(
      "GCP_TRIAL_TOTAL_CREDIT_USD",
      process.env.GCP_TRIAL_TOTAL_CREDIT_USD,
    ),
    googleOauthClientId: pick(
      "GOOGLE_OAUTH_CLIENT_ID",
      process.env.GOOGLE_OAUTH_CLIENT_ID,
    ),
    googleOauthClientSecret: pick(
      "GOOGLE_OAUTH_CLIENT_SECRET",
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    ),
    googleOauthRedirectUri: pick(
      "GOOGLE_OAUTH_REDIRECT_URI",
      process.env.GOOGLE_OAUTH_REDIRECT_URI,
    ),
    appUrl: pick("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
    telegramBotToken: pick("TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN),
    telegramChatId: pick("TELEGRAM_CHAT_ID", process.env.TELEGRAM_CHAT_ID),
    inboxAutoSyncEnabled: (process.env.INBOX_AUTO_SYNC_ENABLED?.trim() || "true") !== "false",
    inboxPollIntervalSeconds:
      Number.parseInt(
        process.env.INBOX_POLL_INTERVAL_SECONDS?.trim() || "60",
        10,
      ) || 60,
    schedulerSecret: process.env.SCHEDULER_SECRET?.trim() || null,
  };
}

export function getStorageMode() {
  const env = getEnv();

  return env.supabaseUrl && env.supabaseServiceRoleKey ? "supabase" : "local";
}

export function getProviderStatuses(): ProviderStatus[] {
  const env = getEnv();
  const storageMode = getStorageMode();

  return [
    {
      label: "Google Places",
      connected: Boolean(env.googleMapsApiKey),
      hint: env.googleMapsApiKey
        ? "Lead discovery can hit Maps and Places."
        : "Add GOOGLE_MAPS_API_KEY to run live lead search.",
    },
    {
      label: "OpenAI Web Search",
      connected: Boolean(env.openAiApiKey),
      hint: env.openAiApiKey
        ? `Enrichment will use ${env.openAiModel}.`
        : "Add OPENAI_API_KEY to research owners and public contacts.",
    },
    {
      label: "Gemini Search",
      connected: Boolean(env.geminiApiKey),
      hint: env.geminiApiKey
        ? `Fallback enrichment is ready with ${env.geminiModel}.`
        : "Add GEMINI_API_KEY to enable Gemini fallback research.",
    },
    {
      label: "Storage",
      connected: true,
      hint:
        storageMode === "supabase"
          ? "Using Supabase for durable leads, contacts, runs, and job cursors."
          : "Using local JSON storage until Supabase env vars are connected.",
    },
    {
      label: "Gmail OAuth",
      connected: Boolean(
        env.googleOauthClientId && env.googleOauthClientSecret && env.googleOauthRedirectUri,
      ),
      hint:
        env.googleOauthClientId && env.googleOauthClientSecret && env.googleOauthRedirectUri
          ? "Mailboxes can connect through Google OAuth."
          : "Add Google OAuth env vars before connecting Gmail mailboxes.",
    },
  ];
}
