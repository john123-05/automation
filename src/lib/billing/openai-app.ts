import "server-only";
import type { WorkflowRun, OpenAiRunSpend } from "@/lib/sales-machine/types";

const OPENAI_WEB_SEARCH_CALL_COST_USD = 10 / 1000;

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
    // Inference: the current gpt-5-mini alias maps to the latest mini pricing tier.
    prefixes: ["gpt-5-mini", "gpt-5.4-mini"],
    pricing: {
      inputPerMillion: 0.75,
      cachedInputPerMillion: 0.075,
      outputPerMillion: 4.5,
    },
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

export function estimateOpenAiRunSpend({
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
}): OpenAiRunSpend | null {
  const pricing = getModelPricing(model);

  if (!pricing) {
    return null;
  }

  const nonCachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const estimatedCostUsd =
    (nonCachedInputTokens / 1_000_000) * pricing.inputPerMillion +
    (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    webSearchCalls * OPENAI_WEB_SEARCH_CALL_COST_USD;

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

export function sumOpenAiRunSpend(spendItems: OpenAiRunSpend[]): OpenAiRunSpend | null {
  if (spendItems.length === 0) {
    return null;
  }

  return spendItems.reduce<OpenAiRunSpend>(
    (total, item) => ({
      model: total.model,
      inputTokens: total.inputTokens + item.inputTokens,
      cachedInputTokens: total.cachedInputTokens + item.cachedInputTokens,
      outputTokens: total.outputTokens + item.outputTokens,
      webSearchCalls: total.webSearchCalls + item.webSearchCalls,
      estimatedCostUsd: total.estimatedCostUsd + item.estimatedCostUsd,
      recordedAt: item.recordedAt > total.recordedAt ? item.recordedAt : total.recordedAt,
    }),
    {
      model: spendItems[0]!.model,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      webSearchCalls: 0,
      estimatedCostUsd: 0,
      recordedAt: spendItems[0]!.recordedAt,
    },
  );
}

export function readRunOpenAiSpend(run: WorkflowRun) {
  const spend = run.input?.openAiSpend;

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

export function getAppTrackedOpenAiSpend(runs: WorkflowRun[]) {
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

    const spend = readRunOpenAiSpend(run);

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
