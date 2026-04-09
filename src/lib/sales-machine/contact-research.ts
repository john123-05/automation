import type { AiResearchProvider, Lead, OpenAiRunSpend } from "@/lib/sales-machine/types";
import {
  getFallbackReason,
  type EnrichmentResult,
} from "@/lib/sales-machine/contact-enrichment-schema";
import { sumOpenAiRunSpend } from "@/lib/billing/openai-app";
import { enrichLeadWithGemini } from "@/lib/sales-machine/gemini-enrichment";
import { enrichLeadWithOpenAi } from "@/lib/sales-machine/openai-enrichment";
import { serializeError } from "@/lib/sales-machine/utils";

type ResearchEnv = {
  openAiApiKey: string | null;
  openAiModel: string;
  geminiApiKey: string | null;
  geminiModel: string;
};

type ResearchProvider = {
  id: AiResearchProvider;
  label: string;
  run: (lead: Lead) => Promise<EnrichmentResult>;
};

export type ResearchAttempt = {
  provider: AiResearchProvider;
  label: string;
  outcome: "success" | "failed" | "fallback";
  reason: string;
  error: string | null;
  peopleFound: number | null;
  billing: OpenAiRunSpend | null;
  estimatedCostUsd: number | null;
};

export function describeResearchProvider(provider: AiResearchProvider) {
  return provider === "gemini:google_search" ? "Gemini Google Search" : "OpenAI Web Search";
}

export function getAvailableResearchProviders(env: ResearchEnv) {
  return getOrderedResearchProviders(env, ["gemini:google_search", "openai:web_search"]);
}

export function getOrderedResearchProviders(
  env: ResearchEnv,
  preferredOrder: AiResearchProvider[],
) {
  const providers = new Map<AiResearchProvider, ResearchProvider>();

  if (env.openAiApiKey) {
    providers.set("openai:web_search", {
      id: "openai:web_search",
      label: describeResearchProvider("openai:web_search"),
      run: (lead) =>
        enrichLeadWithOpenAi({
          apiKey: env.openAiApiKey!,
          model: env.openAiModel,
          lead,
        }),
    });
  }

  if (env.geminiApiKey) {
    providers.set("gemini:google_search", {
      id: "gemini:google_search",
      label: describeResearchProvider("gemini:google_search"),
      run: (lead) =>
        enrichLeadWithGemini({
          apiKey: env.geminiApiKey!,
          model: env.geminiModel,
          lead,
        }),
    });
  }

  return preferredOrder
    .map((providerId) => providers.get(providerId) ?? null)
    .filter(Boolean) as ResearchProvider[];
}

export async function enrichLeadWithFallback({
  lead,
  env,
  providerOrder,
}: {
  lead: Lead;
  env: ResearchEnv;
  providerOrder?: AiResearchProvider[];
}) {
  const providers = getOrderedResearchProviders(
    env,
    providerOrder ?? ["gemini:google_search", "openai:web_search"],
  );

  if (providers.length === 0) {
    throw new Error(
      "No AI research provider is configured. Add OPENAI_API_KEY or GEMINI_API_KEY before running enrichment.",
    );
  }

  const attempts: ResearchAttempt[] = [];
  let fallbackCandidate:
    | {
        provider: AiResearchProvider;
        result: EnrichmentResult;
      }
    | null = null;
  let lastError: string | null = null;

  for (const [index, provider] of providers.entries()) {
    try {
      const result = await provider.run(lead);
      const fallbackReason = getFallbackReason(result);
      const hasAnotherProvider = index < providers.length - 1;

      if (fallbackReason && hasAnotherProvider) {
        fallbackCandidate ??= {
          provider: provider.id,
          result,
        };

        attempts.push({
          provider: provider.id,
          label: provider.label,
          outcome: "fallback",
          reason: `${fallbackReason} Trying the next provider.`,
          error: null,
          peopleFound: result.people.length,
          billing: result.billing ?? null,
          estimatedCostUsd: result.billing?.estimatedCostUsd ?? null,
        });

        continue;
      }

      attempts.push({
        provider: provider.id,
        label: provider.label,
        outcome: "success",
        reason: fallbackReason ?? "Accepted as the final enrichment result.",
        error: null,
        peopleFound: result.people.length,
        billing: result.billing ?? null,
        estimatedCostUsd: result.billing?.estimatedCostUsd ?? null,
      });

      return {
        ...result,
        provider: provider.id,
        billing: sumOpenAiRunSpend(
          [result.billing].filter(Boolean) as NonNullable<typeof result.billing>[],
        ),
        attempts,
      };
    } catch (error) {
      lastError = serializeError(error);
      attempts.push({
        provider: provider.id,
        label: provider.label,
        outcome: "failed",
        reason: "The provider request failed.",
        error: lastError,
        peopleFound: null,
        billing: null,
        estimatedCostUsd: null,
      });
    }
  }

  if (fallbackCandidate) {
    attempts.push({
      provider: fallbackCandidate.provider,
      label: describeResearchProvider(fallbackCandidate.provider),
      outcome: "success",
      reason: "Used the best available earlier result after later fallback attempts failed.",
      error: lastError,
      peopleFound: fallbackCandidate.result.people.length,
      billing: fallbackCandidate.result.billing ?? null,
      estimatedCostUsd: fallbackCandidate.result.billing?.estimatedCostUsd ?? null,
    });

    return {
      ...fallbackCandidate.result,
      provider: fallbackCandidate.provider,
      billing: sumOpenAiRunSpend(
        [fallbackCandidate.result.billing].filter(Boolean) as NonNullable<
          typeof fallbackCandidate.result.billing
        >[],
      ),
      attempts,
    };
  }

  throw new Error(lastError ?? "All research providers failed.");
}
