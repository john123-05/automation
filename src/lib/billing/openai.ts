import "server-only";
import { getEnv } from "@/lib/env";
import type { OpenAiBillingSnapshot } from "@/lib/billing/types";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/billing/utils";
import { serializeError } from "@/lib/sales-machine/utils";

type OpenAiCostResult = {
  amount?: {
    value?: number | string;
    currency?: string;
  } | null;
};

type OpenAiCostBucket = {
  start_time?: number;
  results?: OpenAiCostResult[] | null;
  result?: OpenAiCostResult[] | null;
};

type OpenAiCostsResponse = {
  data?: OpenAiCostBucket[] | null;
  has_more?: boolean;
  next_page?: string | null;
};

function sumBucketAmounts(buckets: OpenAiCostBucket[]) {
  let total = 0;
  let currency: string | null = null;

  for (const bucket of buckets) {
    const results = bucket.results ?? bucket.result ?? [];

    for (const result of results) {
      const value = result.amount?.value;

      if (typeof value === "number") {
        total += value;
      } else if (typeof value === "string") {
        const parsed = Number.parseFloat(value);

        if (Number.isFinite(parsed)) {
          total += parsed;
        }
      }

      if (!currency && result.amount?.currency) {
        currency = result.amount.currency.trim().toUpperCase();
      }
    }
  }

  return {
    total,
    currency,
  };
}

async function fetchCostBuckets({
  adminKey,
  startTime,
  endTime,
}: {
  adminKey: string;
  startTime: number;
  endTime: number;
}) {
  const buckets: OpenAiCostBucket[] = [];
  let nextPage: string | null = null;

  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");

    if (nextPage) {
      url.searchParams.set("page", nextPage);
    }

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminKey}`,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });

        if (response.ok) {
          lastError = null;
          break;
        }

        const body = await response.text();
        lastError = new Error(`OpenAI costs request failed (${response.status}): ${body}`);

        if (response.status < 500 || attempt === 3) {
          throw lastError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === 3) {
          throw lastError;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }

    if (!response || !response.ok) {
      throw lastError ?? new Error("OpenAI costs request failed.");
    }

    const payload = (await response.json()) as OpenAiCostsResponse;
    buckets.push(...(payload.data ?? []));
    nextPage = payload.has_more ? payload.next_page ?? null : null;
  } while (nextPage);

  return buckets;
}

async function fetchOpenAiBillingSnapshot(env = getEnv()): Promise<OpenAiBillingSnapshot> {
  const lastUpdatedAt = new Date().toISOString();

  if (!env.openAiAdminKey) {
    return {
      monthToDateCost: 0,
      last7DaysCost: 0,
      currency: null,
      lastUpdatedAt,
      error: "Add OPENAI_ADMIN_KEY to load whole-organization OpenAI costs.",
    };
  }

  try {
    const now = new Date();
    const monthStart = startOfUtcMonth(now);
    const last7DaysStart = startOfUtcDay(
      new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    );
    const startTime = Math.floor(monthStart.getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);
    const buckets = await fetchCostBuckets({
      adminKey: env.openAiAdminKey,
      startTime,
      endTime,
    });
    const monthTotals = sumBucketAmounts(buckets);
    const last7DaysThreshold = Math.floor(last7DaysStart.getTime() / 1000);
    const last7DaysTotals = sumBucketAmounts(
      buckets.filter((bucket) => (bucket.start_time ?? 0) >= last7DaysThreshold),
    );

    return {
      monthToDateCost: monthTotals.total,
      last7DaysCost: last7DaysTotals.total,
      currency: monthTotals.currency ?? last7DaysTotals.currency ?? "USD",
      lastUpdatedAt,
      error: null,
    };
  } catch (error) {
    return {
      monthToDateCost: 0,
      last7DaysCost: 0,
      currency: null,
      lastUpdatedAt,
      error: serializeError(error),
    };
  }
}

export async function getOpenAiBillingSnapshot() {
  return fetchOpenAiBillingSnapshot();
}
