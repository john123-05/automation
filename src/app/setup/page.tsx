import Link from "next/link";
import { SetupVaultForm } from "@/components/setup-vault-form";
import { getEnv } from "@/lib/env";
import { getSetupVaultSectionsState } from "@/lib/setup-vault";

export const metadata = {
  title: "Setup | Fieldflow",
  description:
    "Local setup vault for rotating API keys, billing credentials, Supabase storage, and Gmail OAuth without hand-editing environment files.",
};

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const env = getEnv();
  const sections = getSetupVaultSectionsState({
    GOOGLE_MAPS_API_KEY: env.googleMapsApiKey,
    OPENAI_API_KEY: env.openAiApiKey,
    OPENAI_ADMIN_KEY: env.openAiAdminKey,
    OPENAI_MODEL: env.openAiModel,
    GEMINI_API_KEY: env.geminiApiKey,
    GEMINI_MODEL: env.geminiModel,
    SUPABASE_URL: env.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
    GCP_BIGQUERY_SERVICE_ACCOUNT_JSON: env.gcpBigQueryServiceAccountJson,
    GCP_BILLING_EXPORT_PROJECT_ID: env.gcpBillingExportProjectId,
    GCP_BILLING_EXPORT_DATASET: env.gcpBillingExportDataset,
    GCP_BILLING_EXPORT_TABLE: env.gcpBillingExportTable,
    GCP_TRIAL_START_DATE: env.gcpTrialStartDate,
    GCP_TRIAL_TOTAL_CREDIT_USD: env.gcpTrialTotalCreditUsd,
    GCP_BILLING_MANUAL_CURRENCY: env.gcpBillingManualCurrency,
    GCP_BILLING_MANUAL_MONTH_TO_DATE_COST: env.gcpBillingManualMonthToDateCost,
    GCP_BILLING_MANUAL_SPEND_SINCE_TRIAL_START: env.gcpBillingManualSpendSinceTrialStart,
    GCP_BILLING_MANUAL_REMAINING_CREDIT: env.gcpBillingManualRemainingCredit,
    GOOGLE_OAUTH_CLIENT_ID: env.googleOauthClientId,
    GOOGLE_OAUTH_CLIENT_SECRET: env.googleOauthClientSecret,
    GOOGLE_OAUTH_REDIRECT_URI: env.googleOauthRedirectUri,
    NEXT_PUBLIC_APP_URL: env.appUrl,
    TELEGRAM_BOT_TOKEN: env.telegramBotToken,
    TELEGRAM_CHAT_ID: env.telegramChatId,
  });

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="glass-panel rounded-[34px] px-6 py-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <Link href="/" className="rounded-full border border-line bg-white/70 px-3 py-1.5">
            Back
          </Link>
          <span className="font-semibold text-slate-900">Setup</span>
          <span className="text-slate-500">
            Rotate providers, switch accounts, and keep the app running without digging through every
            environment variable by hand.
          </span>
        </div>
      </section>

      <div className="mt-6 space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">What this is</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">A local-only vault, not a browser env editor</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              Values saved here stay on the server in a local file and override the same variables from
              your existing env files.
            </p>
            <p>
              This is useful when a Google Cloud account is exhausted and you need to rotate Maps,
              BigQuery, Gemini, OpenAI, Supabase, or Gmail OAuth quickly.
            </p>
            <p>
              It is intended for your local single-user setup. It is not a public multi-user secret manager.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open workspace
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">Fast switch order</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">If an account is burned, do this first</h2>
          <div className="mt-4 space-y-3">
            {[
              "Switch the provider keys you lost first: Places, Gemini, OpenAI, or Supabase.",
              "Save the replacement values here, then restart the dev server if a provider pill still shows the old status.",
              "Keep a simple local setup note for Google Cloud, OAuth, and billing-export steps when you rebuild accounts.",
              "Use manual Google Cloud fallback values only until BigQuery export starts filling with rows.",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[24px] border border-line bg-white/80 px-4 py-3"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SetupVaultForm sections={sections} />
      </div>
    </main>
  );
}
