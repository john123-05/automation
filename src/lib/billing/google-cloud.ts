import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { BigQuery } from "@google-cloud/bigquery";
import { getEnv } from "@/lib/env";
import type { GoogleBillingSnapshot } from "@/lib/billing/types";
import { parseTrialStartDate, startOfUtcMonth } from "@/lib/billing/utils";
import { notifyServerIssue, notifyTrialCreditsUpdated } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

const GOOGLE_CLOUD_BILLING_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BILLING_CACHE_DIR = path.join(process.cwd(), ".data");
const GOOGLE_CLOUD_BILLING_CACHE_PATH = path.join(
  BILLING_CACHE_DIR,
  "google-cloud-billing-cache.json",
);

type GoogleBillingCacheRecord = {
  snapshot: GoogleBillingSnapshot;
  cachedAt: string;
  expiresAt: string;
};

type BigQueryCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

function isEphemeralHostedRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
}

function parseBigQueryCredentials(rawJson: string): BigQueryCredentials {
  const parsed = JSON.parse(rawJson) as BigQueryCredentials;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GCP_BIGQUERY_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }

  return {
    ...parsed,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

async function loadBigQueryCredentials(rawValue: string) {
  const trimmed = rawValue.trim();
  const json =
    trimmed.startsWith("{") || trimmed.startsWith("[")
      ? trimmed
      : await readFile(trimmed, "utf8");

  return parseBigQueryCredentials(json);
}

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchGoogleCloudBillingSnapshot(env = getEnv()): Promise<GoogleBillingSnapshot> {
  const lastUpdatedAt = new Date().toISOString();
  const manualMonthToDateCost = parseOptionalNumber(env.gcpBillingManualMonthToDateCost);
  const manualSpendSinceTrialStart = parseOptionalNumber(
    env.gcpBillingManualSpendSinceTrialStart,
  );
  const manualRemainingCredit = parseOptionalNumber(env.gcpBillingManualRemainingCredit);
  const manualCurrency = env.gcpBillingManualCurrency?.trim().toUpperCase() || null;

  if (
    !env.gcpBigQueryServiceAccountJson ||
    !env.gcpBillingExportProjectId ||
    !env.gcpBillingExportDataset ||
    !env.gcpBillingExportTable
  ) {
    return {
      monthToDateCost: manualMonthToDateCost ?? 0,
      monthToDateGrossCost: manualMonthToDateCost,
      monthToDateCredits: null,
      spendSinceTrialStart: manualSpendSinceTrialStart,
      trialCreditUsed: manualSpendSinceTrialStart,
      currency: manualCurrency,
      lastUpdatedAt,
      error:
        "Add GCP_BIGQUERY_SERVICE_ACCOUNT_JSON, GCP_BILLING_EXPORT_PROJECT_ID, GCP_BILLING_EXPORT_DATASET, and GCP_BILLING_EXPORT_TABLE.",
      pendingExportData: false,
      manualFallbackUsed: manualMonthToDateCost !== null || manualSpendSinceTrialStart !== null,
      manualRemainingCredit,
      cacheExpiresAt: null,
    };
  }

  try {
    const credentials = await loadBigQueryCredentials(env.gcpBigQueryServiceAccountJson);
    const client = new BigQuery({
      projectId: env.gcpBillingExportProjectId,
      credentials,
    });
    const now = new Date();
    const monthStart = startOfUtcMonth(now);
    const trialStart = parseTrialStartDate(env.gcpTrialStartDate);
    const windowStart =
      trialStart && trialStart.getTime() < monthStart.getTime() ? trialStart : monthStart;
    const amountExpression =
      "cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)";
    const tableReference = `\`${env.gcpBillingExportProjectId}.${env.gcpBillingExportDataset}.${env.gcpBillingExportTable}\``;
    const query = `
      SELECT
        COUNT(*) AS row_count,
        ANY_VALUE(currency) AS currency,
        ROUND(SUM(IF(usage_start_time >= @monthStart, cost, 0)), 6) AS month_to_date_gross_cost,
        ROUND(SUM(IF(usage_start_time >= @monthStart, IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0), 0)), 6) AS month_to_date_credits,
        ROUND(SUM(IF(usage_start_time >= @monthStart, ${amountExpression}, 0)), 6) AS month_to_date_cost,
        ${
          trialStart
            ? "ROUND(SUM(IF(usage_start_time >= @trialStart, cost, 0)), 6) AS trial_credit_used,"
            : "CAST(NULL AS FLOAT64) AS trial_credit_used,"
        }
        ${
          trialStart
            ? `ROUND(SUM(IF(usage_start_time >= @trialStart, ${amountExpression}, 0)), 6) AS spend_since_trial_start`
            : "CAST(NULL AS FLOAT64) AS spend_since_trial_start"
        }
      FROM ${tableReference}
      WHERE usage_start_time >= @windowStart
        AND usage_start_time < @now
    `;
    const [rows] = await client.query({
      query,
      params: {
        monthStart,
        trialStart,
        windowStart,
        now,
      },
      useLegacySql: false,
    });
    const row = rows[0] as
      | {
          row_count?: number | string | null;
          currency?: string | null;
          month_to_date_gross_cost?: number | string | null;
          month_to_date_credits?: number | string | null;
          month_to_date_cost?: number | string | null;
          trial_credit_used?: number | string | null;
          spend_since_trial_start?: number | string | null;
        }
      | undefined;

    const rowCount =
      row?.row_count === null || row?.row_count === undefined ? 0 : Number(row.row_count);
    const hasExportData = rowCount > 0;

    const monthToDateCost = hasExportData
      ? Number(row?.month_to_date_cost ?? 0)
      : manualMonthToDateCost ?? 0;
    const monthToDateGrossCost = hasExportData
      ? row?.month_to_date_gross_cost === null || row?.month_to_date_gross_cost === undefined
        ? null
        : Number(row.month_to_date_gross_cost)
      : manualMonthToDateCost;
    const monthToDateCredits = hasExportData
      ? row?.month_to_date_credits === null || row?.month_to_date_credits === undefined
        ? null
        : Math.abs(Number(row.month_to_date_credits))
      : null;
    const spendSinceTrialStart = hasExportData
      ? row?.spend_since_trial_start === null || row?.spend_since_trial_start === undefined
        ? null
        : Number(row.spend_since_trial_start)
      : manualSpendSinceTrialStart;
    const trialCreditUsed = hasExportData
      ? row?.trial_credit_used === null || row?.trial_credit_used === undefined
        ? null
        : Number(row.trial_credit_used)
      : manualSpendSinceTrialStart;
    const currency = hasExportData ? row?.currency?.trim()?.toUpperCase() || null : manualCurrency;

    return {
      monthToDateCost,
      monthToDateGrossCost,
      monthToDateCredits,
      spendSinceTrialStart,
      trialCreditUsed,
      currency,
      lastUpdatedAt,
      error: null,
      pendingExportData: !hasExportData,
      manualFallbackUsed: !hasExportData
        ? manualMonthToDateCost !== null || manualSpendSinceTrialStart !== null
        : false,
      manualRemainingCredit: !hasExportData ? manualRemainingCredit : null,
      cacheExpiresAt: null,
    };
  } catch (error) {
    return {
      monthToDateCost: manualMonthToDateCost ?? 0,
      monthToDateGrossCost: manualMonthToDateCost,
      monthToDateCredits: null,
      spendSinceTrialStart: manualSpendSinceTrialStart,
      trialCreditUsed: manualSpendSinceTrialStart,
      currency: manualCurrency,
      lastUpdatedAt,
      error: serializeError(error),
      pendingExportData: false,
      manualFallbackUsed: manualMonthToDateCost !== null || manualSpendSinceTrialStart !== null,
      manualRemainingCredit,
      cacheExpiresAt: null,
    };
  }
}

async function ensureBillingCacheDir() {
  await mkdir(BILLING_CACHE_DIR, { recursive: true });
}

async function readGoogleCloudBillingCache() {
  if (isEphemeralHostedRuntime()) {
    return null;
  }

  try {
    const raw = (await readFile(GOOGLE_CLOUD_BILLING_CACHE_PATH, "utf8")).trim();

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as GoogleBillingCacheRecord;

    if (!parsed?.snapshot || !parsed?.expiresAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeGoogleCloudBillingCache(snapshot: GoogleBillingSnapshot) {
  const cachedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + GOOGLE_CLOUD_BILLING_CACHE_TTL_MS).toISOString();
  const cachedSnapshot = {
    ...snapshot,
    cacheExpiresAt: expiresAt,
  };

  if (isEphemeralHostedRuntime()) {
    return cachedSnapshot;
  }

  const payload: GoogleBillingCacheRecord = {
    snapshot: cachedSnapshot,
    cachedAt,
    expiresAt,
  };

  try {
    await ensureBillingCacheDir();
    await writeFile(GOOGLE_CLOUD_BILLING_CACHE_PATH, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn(
      "Failed to persist Google Cloud billing cache.",
      error instanceof Error ? error.message : String(error),
    );
  }

  return cachedSnapshot;
}

export async function refreshGoogleCloudBillingSnapshot(options?: {
  suppressAlerts?: boolean;
}) {
  const freshSnapshot = await fetchGoogleCloudBillingSnapshot();
  const snapshot = await writeGoogleCloudBillingCache(freshSnapshot);

  if (!options?.suppressAlerts) {
    await notifyTrialCreditsUpdated(snapshot);
  }

  if (snapshot.error && !options?.suppressAlerts) {
    await notifyServerIssue({
      source: "billing/google-cloud-refresh",
      error: snapshot.error,
    });
  }

  return snapshot;
}

// On Vercel (ephemeral), use Next.js Data Cache instead of the file-based cache to
// avoid calling fetchGoogleCloudBillingSnapshot (and sending Telegram alerts) on every page load.
const getHostedBillingSnapshot = unstable_cache(
  fetchGoogleCloudBillingSnapshot,
  ["google-cloud-billing"],
  { revalidate: GOOGLE_CLOUD_BILLING_CACHE_TTL_MS / 1000, tags: ["google-cloud-billing"] },
);

export async function getGoogleCloudBillingSnapshot(options?: { forceRefresh?: boolean }) {
  if (options?.forceRefresh) {
    return refreshGoogleCloudBillingSnapshot();
  }

  if (isEphemeralHostedRuntime()) {
    const snapshot = await getHostedBillingSnapshot();
    return { ...snapshot, cacheExpiresAt: null };
  }

  const cached = await readGoogleCloudBillingCache();

  if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
    return {
      ...cached.snapshot,
      cacheExpiresAt: cached.expiresAt,
    };
  }

  return refreshGoogleCloudBillingSnapshot();
}
