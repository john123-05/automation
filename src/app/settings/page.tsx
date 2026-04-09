import Link from "next/link";
import { MailboxConnectOptions } from "@/components/mailbox-connect-options";
import { SettingsPreferencesForm } from "@/components/settings-preferences-form";
import { SetupVaultForm } from "@/components/setup-vault-form";
import { requireAppAccess } from "@/lib/app-auth";
import { t } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { getSetupVaultSectionsState } from "@/lib/setup-vault";
import { getUiSettings } from "@/lib/ui-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAppAccess("/settings");
  const env = getEnv();
  const { language, theme } = await getUiSettings();
  const snapshot = await getOutreachSnapshot();
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
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="glass-panel rounded-[34px] px-6 py-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <Link href="/" className="rounded-full border border-line bg-white/70 px-3 py-1.5">
            {t(language, "back")}
          </Link>
          <span className="font-semibold text-slate-900">{t(language, "settings")}</span>
          <span className="text-slate-500">{t(language, "switchAccountsHint")}</span>
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              {language === "de" ? "Abmelden" : "Sign out"}
            </button>
          </form>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <SettingsPreferencesForm language={language} theme={theme} />

        <section className="glass-panel rounded-[32px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "mailboxAccounts")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t(language, "connectedMailboxes")}</h2>
              <p className="mt-3 text-sm text-slate-700">
                {snapshot.connectedMailboxes.length} {t(language, "connectedMailboxes").toLowerCase()}
              </p>
            </div>
            <Link
              href="/outreach/mailboxes"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              {t(language, "openMailboxOperator")}
            </Link>
          </div>
          <div className="mt-6">
            <MailboxConnectOptions language={language} />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "apiConnections")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t(language, "setupVault")}</h2>
          </div>
          <SetupVaultForm sections={sections} language={language} />
        </section>
      </div>
    </main>
  );
}
