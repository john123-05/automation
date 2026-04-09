import type { Lead } from "@/lib/sales-machine/types";
import {
  buildContactResearchPrompt,
  enrichmentJsonSchema,
  normalizeEnrichmentPayload,
} from "@/lib/sales-machine/contact-enrichment-schema";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{
        web?: {
          title?: string;
          uri?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

function extractGeminiText(response: GeminiGenerateContentResponse) {
  const candidate = response.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("");

  if (text) {
    return text;
  }

  if (response.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${response.promptFeedback.blockReason}`);
  }

  throw new Error(
    `Gemini returned no text content${candidate?.finishReason ? ` (finish reason: ${candidate.finishReason})` : ""}.`,
  );
}

export async function enrichLeadWithGemini({
  apiKey,
  model,
  lead,
}: {
  apiKey: string;
  model: string;
  lead: Lead;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildContactResearchPrompt(lead) }],
          },
        ],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: enrichmentJsonSchema,
          temperature: 0.1,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const responseText = extractGeminiText(payload);

  return normalizeEnrichmentPayload(JSON.parse(responseText));
}
