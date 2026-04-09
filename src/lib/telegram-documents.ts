import { getDocumentPayload, listAvailableDocuments } from "@/lib/documents/storage";
import { sendTelegramDocument } from "@/lib/telegram";

type TelegramDocumentLookupResult =
  | {
      kind: "none";
      text: string;
    }
  | {
      kind: "list";
      text: string;
    }
  | {
      kind: "sent";
      text: string;
    };

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDocumentQuery(query: string) {
  return normalizeWhitespace(
    query
      .toLowerCase()
      .replace(/[,;]+/g, " ")
      .replace(/\b(send|send me|show|zeige|schick|schicke|open|öffne|oeffne|find|finde|get|gib mir)\b/g, "")
      .replace(/\b(pdf|document|documents|dokument|dokumente|manual|guide|doc|docs|unterlage|unterlagen)\b/g, "")
      .trim(),
  );
}

function looksLikeDocumentRequest(message: string) {
  return /\b(pdf|document|documents|dokument|dokumente|manual|guide|doc|docs|unterlage|unterlagen)\b/i.test(
    message,
  );
}

function buildHaystack(title: string, fileName: string) {
  return `${title} ${fileName}`.toLowerCase();
}

export async function maybeHandleTelegramDocumentRequest(
  chatId: number,
  rawMessage: string,
): Promise<TelegramDocumentLookupResult | null> {
  if (!looksLikeDocumentRequest(rawMessage)) {
    return null;
  }

  const normalizedQuery = normalizeDocumentQuery(rawMessage);
  const documents = await listAvailableDocuments();

  if (!documents.length) {
    return {
      kind: "none",
      text: "Ich habe aktuell keine Dokumente in der Bibliothek gefunden.",
    };
  }

  const tokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const ranked = documents
    .map((document) => {
      const haystack = buildHaystack(document.title, document.fileName);
      const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
      const exactTitle = document.title.toLowerCase() === normalizedQuery;
      const exactFile = document.fileName.toLowerCase() === normalizedQuery;
      const phraseHit = normalizedQuery ? haystack.includes(normalizedQuery) : false;
      const score =
        (exactTitle ? 100 : 0) +
        (exactFile ? 100 : 0) +
        (phraseHit ? 40 : 0) +
        tokenHits * 10;

      return { document, score, tokenHits };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title));

  if (!ranked.length) {
    return {
      kind: "none",
      text:
        `Ich habe kein passendes Dokument zu "${rawMessage.trim()}" gefunden.\n\n` +
        "Schreib mir bitte den Titel etwas genauer, z.B.:\n" +
        "- warm outreach pdf\n" +
        "- client proposal document\n" +
        "- master the sales call pdf",
    };
  }

  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    const preview = ranked.slice(0, 8).map((entry) => `- ${entry.document.title}`);

    return {
      kind: "list",
      text: [
        `Ich habe mehrere passende Dokumente gefunden:`,
        "",
        ...preview,
        "",
        "Schreib mir einfach den Dokumentnamen noch etwas genauer und ich schicke dir das PDF.",
      ].join("\n"),
    };
  }

  const best = ranked[0].document;
  const payload = await getDocumentPayload(best.slug);

  if (!payload) {
    return {
      kind: "none",
      text: `Das Dokument "${best.title}" konnte ich gerade nicht laden.`,
    };
  }

  await sendTelegramDocument({
    chatId,
    fileName: payload.document.fileName,
    bytes: payload.bytes,
    caption: payload.document.title,
  });

  return {
    kind: "sent",
    text: `Ich habe dir "${best.title}" als PDF geschickt.`,
  };
}
