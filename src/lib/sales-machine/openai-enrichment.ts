import OpenAI from "openai";
import { estimateOpenAiRunSpend } from "@/lib/billing/openai-app";
import type { Lead } from "@/lib/sales-machine/types";
import {
  buildContactResearchPrompt,
  enrichmentJsonSchema,
  normalizeEnrichmentPayload,
} from "@/lib/sales-machine/contact-enrichment-schema";

export async function enrichLeadWithOpenAi({
  apiKey,
  model,
  lead,
}: {
  apiKey: string;
  model: string;
  lead: Lead;
}) {
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model,
    tools: [{ type: "web_search_preview" }],
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are a B2B sales researcher. Return structured JSON only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildContactResearchPrompt(lead),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "contact_enrichment",
        strict: true,
        schema: enrichmentJsonSchema,
      },
    },
  });

  if (!response.output_text?.trim()) {
    throw new Error("OpenAI returned no structured enrichment output.");
  }

  const usage = response.usage;
  const billing =
    usage && response.model
      ? estimateOpenAiRunSpend({
          model: response.model,
          inputTokens: usage.input_tokens ?? 0,
          cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          webSearchCalls: Array.isArray(response.output)
            ? response.output.filter((item) => item.type === "web_search_call").length
            : 0,
          recordedAt: new Date().toISOString(),
        })
      : null;

  return {
    ...normalizeEnrichmentPayload(JSON.parse(response.output_text)),
    billing,
  };
}
