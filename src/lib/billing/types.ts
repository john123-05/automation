export type BillingCardStatus = "ready" | "setup-needed" | "error";

export type BillingMetric = {
  label: string;
  value: string;
};

export type BillingCardId = "google-cloud" | "trial-credits" | "openai";

export type BillingCard = {
  id: BillingCardId;
  title: string;
  titleSuffix?: string | null;
  scopeLabel: string;
  status: BillingCardStatus;
  statusLabel: string;
  summary: string;
  metrics: BillingMetric[];
  lastUpdatedAt: string | null;
  refreshPath?: string | null;
};

export type BillingOverview = {
  cards: BillingCard[];
};

export type BillingSnapshot = {
  monthToDateCost: number;
  currency: string | null;
  lastUpdatedAt: string;
  error: string | null;
};

export type GoogleBillingSnapshot = BillingSnapshot & {
  monthToDateGrossCost: number | null;
  monthToDateCredits: number | null;
  spendSinceTrialStart: number | null;
  trialCreditUsed: number | null;
  pendingExportData?: boolean;
  manualFallbackUsed?: boolean;
  manualRemainingCredit?: number | null;
  cacheExpiresAt?: string | null;
};

export type OpenAiBillingSnapshot = BillingSnapshot & {
  last7DaysCost: number;
};
