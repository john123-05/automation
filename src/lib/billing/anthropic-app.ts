import "server-only";
import type { WorkflowRun, OpenAiRunSpend } from "@/lib/sales-machine/types";

// $10 per 1,000 searches
const CLAUDE_WEB_SEARCH_COST_USD = 10 / 1000;

type ModelPricing = {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

const modelPricingTable: Array<{
  prefixes: string[];
  pricing: ModelPricing;
}> = [
  {
    prefixes: ["claude-haiku-4-5"],
    pricing: { inputPerMillion: 1.0, cachedInputPerMillion: 0.1, outputPerMillion: 5.0 },
  },
  {
    prefixes: ["claude-sonnet-4-6"],
    pricing: { inputPerMillion: 3.0, cachedInputPerMillion: 0.3, outputPerMillion: 15.0 },
  },
  {
    prefixes: ["claude-opus-4-6"],
    pricing: { inputPerMillion: 5.0, cachedInputPerMillion: 0.5, outputPerMillion: 25.0 },
  },
];

function getModelPricing(model: string): ModelPricing | null {
  const normalized = model.trim().toLowerCase();

  for (const entry of modelPricingTable) {
    if (entry.prefixes.some((prefix) => normalized.startsWith(prefix))) {
      return entry.pricing;
    }
  }

  return null;
}

export function estimateClaudeRunSpend({
  model,
  inputTokens,
  cachedInputTokens,
  outputTokens,
  webSearchCalls,
  recordedAt,
}: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  recordedAt: string;
}): OpenAiRunSpend {
  const pricing = getModelPricing(model);
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const estimatedCostUsd = pricing
    ? (nonCachedInputTokens / 1_000_000) * pricing.inputPerMillion +
      (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion +
      webSearchCalls * CLAUDE_WEB_SEARCH_COST_USD
    : 0;

  return {
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    webSearchCalls,
    estimatedCostUsd,
    recordedAt,
  };
}

export function readRunClaudeSpend(run: WorkflowRun): OpenAiRunSpend | null {
  const spend = run.input?.claudeSpend;

  if (!spend || typeof spend !== "object") {
    return null;
  }

  const candidate = spend as Partial<OpenAiRunSpend>;

  if (
    typeof candidate.model !== "string" ||
    typeof candidate.inputTokens !== "number" ||
    typeof candidate.cachedInputTokens !== "number" ||
    typeof candidate.outputTokens !== "number" ||
    typeof candidate.webSearchCalls !== "number" ||
    typeof candidate.estimatedCostUsd !== "number" ||
    typeof candidate.recordedAt !== "string"
  ) {
    return null;
  }

  return candidate as OpenAiRunSpend;
}

export function getAppTrackedClaudeSpend(runs: WorkflowRun[]) {
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const last7DaysStart = now - 6 * 24 * 60 * 60 * 1000;

  let monthToDateCost = 0;
  let last7DaysCost = 0;
  let lastUpdatedAt: string | null = null;

  for (const run of runs) {
    if (run.kind !== "contact-enrichment") {
      continue;
    }

    const spend = readRunClaudeSpend(run);

    if (!spend) {
      continue;
    }

    const recordedAtMs = new Date(spend.recordedAt).getTime();

    if (!Number.isFinite(recordedAtMs)) {
      continue;
    }

    if (recordedAtMs >= monthStart.getTime()) {
      monthToDateCost += spend.estimatedCostUsd;
    }

    if (recordedAtMs >= last7DaysStart) {
      last7DaysCost += spend.estimatedCostUsd;
    }

    if (!lastUpdatedAt || spend.recordedAt > lastUpdatedAt) {
      lastUpdatedAt = spend.recordedAt;
    }
  }

  return {
    monthToDateCost,
    last7DaysCost,
    currency: "USD",
    lastUpdatedAt,
  };
}
