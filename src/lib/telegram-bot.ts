import OpenAI from "openai";
import { saveUploadedDocument } from "@/lib/documents/storage";
import { getEnv } from "@/lib/env";
import { getTelegramCreditReply, looksLikeCreditRequest } from "@/lib/telegram-billing";
import {
  getTelegramAllCostsReply,
  getTelegramOpenAiCostsReply,
  looksLikeAllCostsRequest,
  looksLikeOpenAiCostsRequest,
} from "@/lib/telegram-costs";
import { runContactEnrichment, runLeadSearch } from "@/lib/sales-machine/workflows";
import { maybeHandleTelegramDocumentRequest } from "@/lib/telegram-documents";
import { answerTelegramCallbackQuery, downloadTelegramBotFile, sendTelegramTextMessage } from "@/lib/telegram";
import { lookupSalesMachineData } from "@/lib/telegram-lookup";
import { getWarmupReply, looksLikeWarmupQuery } from "@/lib/telegram-warmup";
import type { ContactEnrichmentInput, LeadSearchInput } from "@/lib/sales-machine/types";

type ParsedLeadSearchRequest = {
  niche: string;
  location: string;
  maxLeads: number;
  radiusMeters: number;
  searchMode: "capped" | "exhaustive";
};

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: {
      id: number;
    };
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      chat?: {
        id: number;
      };
    };
  };
};

const telegramLeadSearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["niche", "location", "maxLeads", "radiusMeters", "searchMode"],
  properties: {
    niche: { type: "string" },
    location: { type: "string" },
    maxLeads: { type: "number" },
    radiusMeters: { type: "number" },
    searchMode: { type: "string", enum: ["capped", "exhaustive"] },
  },
} as const;

function buildLeadSearchPrompt(message: string) {
  return [
    "Extract a lead search request from the user's Telegram message.",
    "Return JSON only.",
    "The request is valid only if you can infer all of these:",
    "- niche",
    "- location",
    "- maxLeads",
    "Use radiusMeters=1500 unless the user clearly specified a distance.",
    "Use searchMode='capped' unless the user clearly asks for exhaustive search.",
    "Examples:",
    "- 'restaurants london uk 100 leads' => niche restaurants, location London, UK, maxLeads 100",
    "- 'suche 50 real estate agents in nerja' => niche real estate agents, location Nerja, maxLeads 50",
    "- 'find 30 dentists near madrid' => niche dentists, location Madrid, maxLeads 30",
    `Message: ${message}`,
  ].join("\n");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildClarifyingReply(originalMessage: string) {
  return [
    `Ich war mir bei "${originalMessage.trim()}" noch nicht sicher, was du genau meinst.`,
    "",
    "Wenn du einen Lead-Run starten willst, schreib bitte:",
    "- Nische",
    "- Ort",
    "- Anzahl Leads",
    "",
    "Beispiele:",
    "- restaurants london uk 100 leads",
    "- suche 50 real estate agents in nerja",
    "",
    "Wenn du etwas nachschlagen willst, schick mir einfach z.B.:",
    "- eine Firma",
    "- eine E-Mail",
    "- eine Telefonnummer",
    "- oder einen Dokumentnamen",
  ].join("\n");
}

function looksLikeLeadSearchRequest(message: string) {
  const normalized = message.toLowerCase();
  const hasEmail = normalized.includes("@");
  const hasPhoneLikeNumber = normalized.replace(/[^\d]/g, "").length >= 6;
  const hasLeadKeyword = /\b(lead|leads|result|results)\b/.test(normalized);
  const hasSearchVerb = /\b(suche|search|find|finde|get me|give me|need|ich brauche)\b/.test(normalized);
  const hasLocationCue = /\b(in|near|around)\b/.test(normalized);
  const hasSmallCount = /\b([1-9]\d{0,2})\b/.test(normalized);

  if (hasEmail || hasPhoneLikeNumber) {
    return false;
  }

  return hasSmallCount && (hasLeadKeyword || hasSearchVerb || hasLocationCue);
}

function stripLeadSearchFillers(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^(for|fuer|für|nach|about)\s+/i, "")
      .replace(/\s+(please|pls|bitte)$/i, "")
      .trim(),
  );
}

function heuristicParseLeadSearchRequest(message: string): ParsedLeadSearchRequest | null {
  const normalized = normalizeWhitespace(
    message
      .toLowerCase()
      .replace(/[,;]+/g, " ")
      .replace(
        /\b(suche|suche nach|find|finde|search|look for|get me|give me|show me|need|ich brauche|please|pls|bitte)\b/g,
        "",
      )
      .trim(),
  );
  const leadsMatch = normalized.match(/(\d{1,3})\s*(lead|leads|results?)\b/) ?? normalized.match(/\b(\d{1,3})\b/);

  if (!leadsMatch) {
    return null;
  }

  const maxLeads = Number.parseInt(leadsMatch[1], 10);

  if (!Number.isFinite(maxLeads) || maxLeads < 1 || maxLeads > 500) {
    return null;
  }

  const withoutLeadCount = stripLeadSearchFillers(normalizeWhitespace(normalized.replace(leadsMatch[0], "")));
  const inMatch = withoutLeadCount.match(/(.+?)\s+\b(?:in|near|around)\b\s+(.+)/);

  if (inMatch) {
    return {
      niche: stripLeadSearchFillers(inMatch[1]),
      location: stripLeadSearchFillers(inMatch[2]),
      maxLeads,
      radiusMeters: 1500,
      searchMode: "capped",
    };
  }

  const forMatch = withoutLeadCount.match(/(?:for|fuer|für)\s+(.+?)\s+\b(?:in|near|around)\b\s+(.+)/);

  if (forMatch) {
    return {
      niche: stripLeadSearchFillers(forMatch[1]),
      location: stripLeadSearchFillers(forMatch[2]),
      maxLeads,
      radiusMeters: 1500,
      searchMode: "capped",
    };
  }

  const tokens = withoutLeadCount.split(" ").filter(Boolean);

  if (tokens.length >= 3) {
    const location = stripLeadSearchFillers(tokens.slice(-2).join(" "));
    const niche = stripLeadSearchFillers(tokens.slice(0, -2).join(" "));

    if (niche && location) {
      return {
        niche,
        location,
        maxLeads,
        radiusMeters: 1500,
        searchMode: "capped",
      };
    }
  }

  return null;
}

async function aiParseLeadSearchRequest(message: string): Promise<ParsedLeadSearchRequest | null> {
  const env = getEnv();

  if (!env.openAiApiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey: env.openAiApiKey });
  const response = await client.responses.create({
    model: env.openAiModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You extract structured lead-search requests." }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: buildLeadSearchPrompt(message) }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "telegram_lead_search",
        strict: true,
        schema: telegramLeadSearchSchema,
      },
    },
  });

  if (!response.output_text?.trim()) {
    return null;
  }

  const parsed = JSON.parse(response.output_text) as ParsedLeadSearchRequest;

  if (!parsed.niche || !parsed.location) {
    return null;
  }

  return {
    niche: normalizeWhitespace(parsed.niche),
    location: normalizeWhitespace(parsed.location),
    maxLeads: Math.max(1, Math.min(500, Math.round(parsed.maxLeads))),
    radiusMeters: Math.max(100, Math.min(50000, Math.round(parsed.radiusMeters || 1500))),
    searchMode: parsed.searchMode === "exhaustive" ? "exhaustive" : "capped",
  };
}

async function parseLeadSearchRequest(message: string) {
  return heuristicParseLeadSearchRequest(message) ?? aiParseLeadSearchRequest(message);
}

function telegramManagedLeadSearchInput(
  parsed: ParsedLeadSearchRequest,
): LeadSearchInput & { telegramSource: true } {
  return {
    ...parsed,
    telegramSource: true,
  };
}

function telegramManagedEnrichmentInput(runId: string): ContactEnrichmentInput & { telegramSource: true } {
  return {
    batchSize: 15,
    includePreviouslyFailed: false,
    allowOpenAiSecondPass: true,
    scope: "run",
    sourceRunId: runId,
    telegramSource: true,
  };
}

async function runTelegramLeadSearch(chatId: number, parsed: ParsedLeadSearchRequest) {
  try {
    const result = await runLeadSearch(telegramManagedLeadSearchInput(parsed));

    await sendTelegramTextMessage({
      chatId,
      text:
        `Ich habe ${result.totalFound} Treffer gefunden und ${result.inserted} neue Leads gespeichert.\n\n` +
        `Soll ich jetzt auch Kontakte recherchieren?`,
      inlineKeyboard: [
        [
          { text: "Ja, Kontakte suchen", callback_data: `enrich_yes:${result.runId}` },
          { text: "Nein", callback_data: `enrich_no:${result.runId}` },
        ],
      ],
    });
  } catch (error) {
    await sendTelegramTextMessage({
      chatId,
      text: `Der Lead-Run ist fehlgeschlagen:\n${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function runTelegramEnrichment(chatId: number, runId: string) {
  try {
    const result = await runContactEnrichment(telegramManagedEnrichmentInput(runId));
    await sendTelegramTextMessage({
      chatId,
      text:
        `Kontakte fertig.\n` +
        `Enriched: ${result.enriched}\nMissing: ${result.missing}\nFailed: ${result.failed}`,
    });
  } catch (error) {
    await sendTelegramTextMessage({
      chatId,
      text: `Die Kontaktrecherche ist fehlgeschlagen:\n${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function handleTelegramMessage(update: TelegramUpdate) {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  const document = update.message?.document;

  if (!chatId) {
    return;
  }

  if (document) {
    await handleTelegramDocumentUpload(chatId, document);
    return;
  }

  if (!text) {
    await sendTelegramTextMessage({
      chatId,
      text: buildClarifyingReply("deine Nachricht"),
    });
    return;
  }

  if (looksLikeCreditRequest(text)) {
    await sendTelegramTextMessage({
      chatId,
      text: await getTelegramCreditReply(),
    });
    return;
  }

  if (looksLikeOpenAiCostsRequest(text)) {
    await sendTelegramTextMessage({
      chatId,
      text: await getTelegramOpenAiCostsReply(),
    });
    return;
  }

  if (looksLikeAllCostsRequest(text)) {
    await sendTelegramTextMessage({
      chatId,
      text: await getTelegramAllCostsReply(),
    });
    return;
  }

  if (looksLikeWarmupQuery(text)) {
    await sendTelegramTextMessage({
      chatId,
      text: await getWarmupReply(text, "de"),
    });
    return;
  }

  const documentResult = await maybeHandleTelegramDocumentRequest(chatId, text);

  if (documentResult) {
    await sendTelegramTextMessage({
      chatId,
      text: documentResult.text,
    });
    return;
  }

  if (!looksLikeLeadSearchRequest(text)) {
    const lookup = await lookupSalesMachineData(text);

    await sendTelegramTextMessage({
      chatId,
      text: lookup.text,
    });
    return;
  }

  const parsed = await parseLeadSearchRequest(text);

  if (!parsed) {
    await sendTelegramTextMessage({
      chatId,
      text: buildClarifyingReply(text),
    });
    return;
  }

  await sendTelegramTextMessage({
    chatId,
    text:
      `Starte jetzt einen Lead-Run für:\n` +
      `Nische: ${parsed.niche}\nOrt: ${parsed.location}\nMax Leads: ${parsed.maxLeads}`,
  });

  await runTelegramLeadSearch(chatId, parsed);
}

async function handleTelegramDocumentUpload(
  chatId: number,
  document: NonNullable<TelegramUpdate["message"]>["document"],
) {
  if (!document?.file_id) {
    return;
  }

  const fileName = document.file_name?.trim() || "document.pdf";
  const mimeType = document.mime_type?.toLowerCase() || "";
  const looksLikePdf = fileName.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf";

  if (!looksLikePdf) {
    await sendTelegramTextMessage({
      chatId,
      text: "Ich kann aktuell nur PDF-Dokumente hochladen. Schick mir bitte eine PDF-Datei.",
    });
    return;
  }

  try {
    const bytes = await downloadTelegramBotFile(document.file_id);
    const uploaded = await saveUploadedDocument(
      new File([bytes], fileName, {
        type: mimeType || "application/pdf",
      }),
    );

    await sendTelegramTextMessage({
      chatId,
      text:
        `Dokument gespeichert: ${uploaded.title}\n` +
        "Es ist jetzt in deiner Dokumentbibliothek verfuegbar und kann auch wieder per Bot gefunden werden.",
    });
  } catch (error) {
    await sendTelegramTextMessage({
      chatId,
      text: `Das Dokument konnte ich nicht hochladen:\n${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function handleTelegramCallback(update: TelegramUpdate) {
  const callback = update.callback_query;
  const data = callback?.data;
  const chatId = callback?.message?.chat?.id;

  if (!callback?.id || !data || !chatId) {
    return;
  }

  if (data.startsWith("enrich_yes:")) {
    const runId = data.replace("enrich_yes:", "");
    await answerTelegramCallbackQuery(callback.id, "Starte Kontaktrecherche...");
    await sendTelegramTextMessage({
      chatId,
      text: "Okay, ich suche jetzt Kontakte fuer diesen Run.",
    });
    await runTelegramEnrichment(chatId, runId);
    return;
  }

  if (data.startsWith("enrich_no:")) {
    await answerTelegramCallbackQuery(callback.id, "Okay.");
    await sendTelegramTextMessage({
      chatId,
      text: "Alles klar, ich lasse es bei den Leads.",
    });
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const env = getEnv();
  const allowedChatId = env.telegramChatId ? Number(env.telegramChatId) : null;
  const incomingChatId =
    update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? null;

  if (allowedChatId && incomingChatId !== null && incomingChatId !== allowedChatId) {
    return;
  }

  if (update.callback_query) {
    await handleTelegramCallback(update);
    return;
  }

  await handleTelegramMessage(update);
}
