import Anthropic from "@anthropic-ai/sdk";
import type { BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { estimateClaudeRunSpend } from "@/lib/billing/anthropic-app";
import type { Lead } from "@/lib/sales-machine/types";
import {
  buildContactResearchPrompt,
  enrichmentJsonSchema,
  normalizeEnrichmentPayload,
} from "@/lib/sales-machine/contact-enrichment-schema";

export async function enrichLeadWithClaude({
  apiKey,
  model,
  lead,
}: {
  apiKey: string;
  model: string;
  lead: Lead;
}) {
  const client = new Anthropic({ apiKey });

  const response = await client.beta.messages.create({
    model,
    max_tokens: 2048,
    betas: ["web-search-2025-03-05"],
    system:
      "You are a B2B sales researcher. Search the web to find information about the company and its decision-makers, then use the contact_enrichment tool to return your structured findings. Return only public information supported by web results.",
    tools: [
      { type: "web_search_20250305", name: "web_search" },
      {
        name: "contact_enrichment",
        description:
          "Return the structured contact enrichment results after researching the company.",
        input_schema: enrichmentJsonSchema as { type: "object"; [key: string]: unknown },
      },
    ],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: buildContactResearchPrompt(lead) }],
  });

  // Find the contact_enrichment tool_use block in the response
  const toolUse = response.content.find(
    (block): block is BetaToolUseBlock =>
      block.type === "tool_use" &&
      (block as BetaToolUseBlock).name === "contact_enrichment",
  );

  let payload: unknown;

  if (toolUse) {
    payload = toolUse.input;
  } else {
    // Fallback: extract JSON from any text blocks
    const textBlocks = response.content.filter((b) => b.type === "text");
    const rawText = textBlocks
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    if (!rawText) {
      throw new Error("Claude returned no enrichment output.");
    }

    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = fenceMatch ? fenceMatch[1]!.trim() : rawText;

    payload = JSON.parse(jsonText);
  }

  const usage = response.usage;
  const webSearchCalls = usage.server_tool_use?.web_search_requests ?? 0;
  const billing = estimateClaudeRunSpend({
    model,
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens,
    webSearchCalls,
    recordedAt: new Date().toISOString(),
  });

  return {
    ...normalizeEnrichmentPayload(payload),
    billing,
  };
}
