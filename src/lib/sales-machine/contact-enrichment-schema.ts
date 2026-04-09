import type { OpenAiRunSpend } from "@/lib/sales-machine/types";
import { z } from "zod";
import type { Lead } from "@/lib/sales-machine/types";
import { compactNullableText } from "@/lib/sales-machine/utils";

export const personSchema = z.object({
  name: z.string().trim().min(1),
  title: z.string().trim().nullable(),
  email: z.string().trim().nullable(),
  linkedin: z.string().trim().nullable(),
  instagram: z.string().trim().nullable(),
  twitter: z.string().trim().nullable(),
  facebook: z.string().trim().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const enrichmentSchema = z.object({
  companyName: z.string(),
  summary: z.string(),
  people: z.array(personSchema).max(5),
});

export const enrichmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    companyName: {
      type: "string",
      description: "The name of the company being researched.",
    },
    summary: {
      type: "string",
      description: "A short practical research summary for outbound sales use.",
    },
    people: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "The public full name of the likely decision-maker.",
          },
          title: {
            type: ["string", "null"],
            description: "The most likely title or role based on public web results.",
          },
          email: {
            type: ["string", "null"],
            description: "A public email if one is clearly available.",
          },
          linkedin: {
            type: ["string", "null"],
            description: "A direct LinkedIn profile URL when available.",
          },
          instagram: {
            type: ["string", "null"],
            description: "A direct Instagram profile URL when available.",
          },
          twitter: {
            type: ["string", "null"],
            description: "A direct X or Twitter profile URL when available.",
          },
          facebook: {
            type: ["string", "null"],
            description: "A direct Facebook profile URL when available.",
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "How confident the model is that this person is a useful outreach target.",
          },
        },
        required: [
          "name",
          "title",
          "email",
          "linkedin",
          "instagram",
          "twitter",
          "facebook",
          "confidence",
        ],
      },
    },
  },
  required: ["companyName", "summary", "people"],
} as const;

export type EnrichmentResult = {
  companyName: string;
  summary: string;
  people: Array<z.infer<typeof personSchema>>;
  billing?: OpenAiRunSpend | null;
};

export function buildContactResearchPrompt(lead: Lead) {
  return [
    "You are a B2B sales researcher.",
    "Find likely founders, owners, operators, directors, managing directors, partners, or general managers for the company.",
    "Return only public information that is reasonably supported by web results.",
    "Prefer exact names and practical titles over vague guesses.",
    "If a contact field is not public, return null for that field.",
    "Keep the summary short and practical for outbound sales use.",
    "",
    `Company name: ${lead.companyName}`,
    `Website: ${lead.websiteUri ?? "Unknown"}`,
    `Address: ${lead.address}`,
    `Phone: ${lead.internationalPhoneNumber ?? lead.nationalPhoneNumber ?? "Unknown"}`,
    "",
    "Find up to 3 likely decision-makers that a sales outreach workflow would care about.",
  ].join("\n");
}

export function normalizeEnrichmentPayload(payload: unknown): EnrichmentResult {
  const parsed = enrichmentSchema.parse(payload);

  return {
    companyName: parsed.companyName,
    summary: parsed.summary.trim(),
    people: parsed.people.map((person) => ({
      ...person,
      title: compactNullableText(person.title),
      email: compactNullableText(person.email),
      linkedin: compactNullableText(person.linkedin),
      instagram: compactNullableText(person.instagram),
      twitter: compactNullableText(person.twitter),
      facebook: compactNullableText(person.facebook),
    })),
  };
}

export function getFallbackReason(result: EnrichmentResult) {
  if (result.people.length === 0) {
    return "No decision-makers were returned.";
  }

  const hasActionableContact = result.people.some(
    (person) =>
      person.confidence !== "low" ||
      Boolean(
        person.email ||
          person.linkedin ||
          person.instagram ||
          person.twitter ||
          person.facebook,
      ),
  );

  if (!hasActionableContact) {
    return "Only low-confidence contacts without direct public contact channels were returned.";
  }

  return null;
}
