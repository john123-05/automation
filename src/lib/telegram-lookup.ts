import { formatDateTime } from "@/lib/sales-machine/utils";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { buildWorkspaceCompanyRecords } from "@/lib/sales-machine/workspace-crm";
import type { Contact, WorkspaceCompanyRecord } from "@/lib/sales-machine/types";

type TelegramLookupResponse = {
  found: boolean;
  text: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d+]/g, "");
}

function normalizeLookupQuery(query: string) {
  return normalizeWhitespace(
    query
      .toLowerCase()
      .replace(/[,;]+/g, " ")
      .replace(
        /\b(lookup|look up|find|finde|suche|search|show|zeige|details|detail|kontaktdaten|contact data|company|business|lead|person|contact)\b/g,
        "",
      ),
  );
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildRecordHaystack(record: WorkspaceCompanyRecord) {
  const contactText = record.contacts
    .flatMap((contact) => [
      contact.name,
      contact.title,
      contact.email,
      contact.linkedin,
      contact.instagram,
      contact.twitter,
      contact.facebook,
    ])
    .filter(Boolean)
    .join(" ");

  return normalizeWhitespace(
    [
      record.lead.companyName,
      record.lead.address,
      record.lead.websiteUri,
      record.lead.niche,
      record.lead.locationLabel,
      record.lead.nationalPhoneNumber,
      record.lead.internationalPhoneNumber,
      record.lead.researchSummary,
      record.crm?.notes,
      record.crm?.ownerLabel,
      record.thread?.contactName,
      record.thread?.contactEmail,
      record.thread?.subject,
      record.thread?.snippet,
      contactText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
}

function getContactPreview(contact: Contact) {
  const parts = [contact.name];

  if (contact.title) {
    parts.push(contact.title);
  }

  if (contact.email) {
    parts.push(contact.email);
  }

  return `- ${parts.join(" · ")}`;
}

function scoreRecord(record: WorkspaceCompanyRecord, normalizedQuery: string, tokens: string[]) {
  const haystack = buildRecordHaystack(record);
  const normalizedPhoneQuery = normalizePhone(normalizedQuery);
  const queryLooksLikeEmail = normalizedQuery.includes("@");
  const queryLooksLikePhone = normalizedPhoneQuery.length >= 6;

  const company = record.lead.companyName.toLowerCase();
  const contactEmails = record.contacts.map((contact) => contact.email?.toLowerCase()).filter(Boolean);
  const contactNames = record.contacts.map((contact) => contact.name.toLowerCase());
  const phones = [
    normalizePhone(record.lead.nationalPhoneNumber),
    normalizePhone(record.lead.internationalPhoneNumber),
  ].filter(Boolean);

  let score = 0;

  if (queryLooksLikeEmail && contactEmails.some((email) => email === normalizedQuery)) {
    score += 120;
  }

  if (queryLooksLikePhone && phones.some((phone) => phone.includes(normalizedPhoneQuery))) {
    score += 110;
  }

  if (company === normalizedQuery) {
    score += 100;
  } else if (company.includes(normalizedQuery)) {
    score += 65;
  }

  if (contactNames.some((name) => name.includes(normalizedQuery))) {
    score += 55;
  }

  if (record.lead.websiteUri?.toLowerCase().includes(normalizedQuery)) {
    score += 45;
  }

  const tokenHits = tokens.filter((token) => haystack.includes(token)).length;

  if (tokens.length > 0 && tokenHits === tokens.length) {
    score += tokenHits * 12;
  } else if (tokenHits > 0) {
    score += tokenHits * 4;
  }

  if (queryLooksLikeEmail || queryLooksLikePhone) {
    return score;
  }

  if (tokens.length === 0) {
    return score;
  }

  return tokenHits === tokens.length ? score : 0;
}

function formatRecordSummary(record: WorkspaceCompanyRecord) {
  const lines = [
    `${record.lead.companyName}`,
    `${record.lead.niche} · ${record.lead.locationLabel}`,
  ];

  if (record.lead.websiteUri) {
    lines.push(record.lead.websiteUri);
  }

  if (record.lead.internationalPhoneNumber || record.lead.nationalPhoneNumber) {
    lines.push(record.lead.internationalPhoneNumber ?? record.lead.nationalPhoneNumber ?? "");
  }

  lines.push(`${record.contacts.length} Kontakt(e)`);

  return `- ${lines.filter(Boolean).join(" · ")}`;
}

function formatDetailedRecord(record: WorkspaceCompanyRecord) {
  const lines = [
    `${record.lead.companyName}`,
    `${record.lead.niche} · ${record.lead.locationLabel}`,
  ];

  if (record.lead.address) {
    lines.push(`Adresse: ${record.lead.address}`);
  }

  if (record.lead.websiteUri) {
    lines.push(`Website: ${record.lead.websiteUri}`);
  }

  if (record.lead.internationalPhoneNumber || record.lead.nationalPhoneNumber) {
    lines.push(`Telefon: ${record.lead.internationalPhoneNumber ?? record.lead.nationalPhoneNumber}`);
  }

  if (record.crm?.nextAction) {
    lines.push(`Next step: ${record.crm.nextAction.replace(/_/g, " ")}`);
  }

  if (record.thread?.subject) {
    const threadLine = [`Letzte Mail: ${record.thread.subject}`];

    if (record.thread.lastMessageAt) {
      threadLine.push(formatDateTime(record.thread.lastMessageAt));
    }

    lines.push(threadLine.join(" · "));
  }

  if (record.contacts.length) {
    lines.push("", "Kontakte:");
    lines.push(...record.contacts.slice(0, 4).map(getContactPreview));

    if (record.contacts.length > 4) {
      lines.push(`- +${record.contacts.length - 4} weitere`);
    }
  }

  if (record.crm?.notes) {
    lines.push("", `CRM Notes: ${record.crm.notes}`);
  }

  return lines.join("\n");
}

export async function lookupSalesMachineData(rawQuery: string): Promise<TelegramLookupResponse> {
  const normalizedQuery = normalizeLookupQuery(rawQuery);

  if (!normalizedQuery) {
    return {
      found: false,
      text:
        "Ich brauche noch etwas mehr, um sinnvoll zu suchen.\n\n" +
        "Schick mir bitte z.B.:\n" +
        "- eine Firma\n" +
        "- eine E-Mail\n" +
        "- eine Telefonnummer\n" +
        "- oder Nische + Ort",
    };
  }

  const snapshot = await getOutreachSnapshot();
  const records = buildWorkspaceCompanyRecords(snapshot);
  const tokens = tokenize(normalizedQuery);
  const ranked = records
    .map((record) => ({
      record,
      score: scoreRecord(record, normalizedQuery, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.record.latestActivityAt.localeCompare(a.record.latestActivityAt));

  if (!ranked.length) {
    return {
      found: false,
      text:
        `Ich habe nichts zu "${rawQuery.trim()}" gefunden.\n\n` +
        "Versuch es bitte genauer, z.B. mit:\n" +
        "- Firmenname\n" +
        "- E-Mail-Adresse\n" +
        "- Telefonnummer\n" +
        "- Nische + Ort",
    };
  }

  if (ranked.length === 1) {
    return {
      found: true,
      text: formatDetailedRecord(ranked[0].record),
    };
  }

  if (ranked.length <= 3) {
    return {
      found: true,
      text: ranked
        .map(({ record }) => formatDetailedRecord(record))
        .join("\n\n--------------------\n\n"),
    };
  }

  const preview = ranked.slice(0, 8).map(({ record }) => formatRecordSummary(record));

  return {
    found: true,
    text: [
      `Ich habe ${ranked.length} Treffer zu "${rawQuery.trim()}" gefunden.`,
      "",
      ...preview,
      ...(ranked.length > preview.length ? ["", `+${ranked.length - preview.length} weitere Treffer`] : []),
      "",
      "Schreib mir danach einfach z.B. die Firma, E-Mail oder Telefonnummer nochmal fuer die Details.",
    ].join("\n"),
  };
}
