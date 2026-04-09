import { ImapFlow } from "imapflow";
import type { AddressObject, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import type { ImapMailboxConfig } from "@/lib/sales-machine/mailbox-config";

export type ImapSyncedMessage = {
  externalMessageId: string;
  externalThreadId: string;
  subject: string;
  snippet: string;
  bodyText: string;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  sentAt: string;
  references: string[];
};

function normalizeSubject(value: string | null | undefined) {
  return (value ?? "(no subject)").trim() || "(no subject)";
}

function extractSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function firstMailboxEntry(value: ParsedMail["from"] | ParsedMail["to"]) {
  if (!value) {
    return null;
  }

  const source = Array.isArray(value) ? value[0] : value;
  const addressObject = source as AddressObject;

  return addressObject.value?.[0] ?? null;
}

export async function listImapInboxMessages(input: {
  config: ImapMailboxConfig;
  maxMessages?: number;
}) {
  const client = new ImapFlow({
    host: input.config.host,
    port: input.config.port,
    secure: input.config.secure,
    auth: {
      user: input.config.username,
      pass: input.config.password,
    },
    logger: false,
  });

  await client.connect();

  try {
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const maxMessages = input.maxMessages ?? 10;

    if (mailbox.exists === 0) {
      return [] as ImapSyncedMessage[];
    }

    const start = Math.max(1, mailbox.exists - maxMessages + 1);
    const range = `${start}:${mailbox.exists}`;
    const messages: ImapSyncedMessage[] = [];

    for await (const message of client.fetch(
      range,
      {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
      },
      {
        uid: true,
      },
    )) {
      if (!message.source) {
        continue;
      }

      const parsed = await simpleParser(message.source);
      const fromEntry = firstMailboxEntry(parsed.from);
      const toEntry = firstMailboxEntry(parsed.to);
      const fromAddress = fromEntry?.address ?? null;
      const fromName = fromEntry?.name ?? null;
      const toAddress = toEntry?.address ?? null;
      const bodyText =
        typeof parsed.text === "string" && parsed.text.trim()
          ? parsed.text.trim()
          : typeof parsed.html === "string"
            ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : "";
      const subject = normalizeSubject(parsed.subject ?? message.envelope?.subject);
      const externalMessageId =
        parsed.messageId?.trim() || `${input.config.username}:imap:${message.uid}`;
      const references = [
        ...(parsed.references ?? []),
        ...(parsed.inReplyTo ? [parsed.inReplyTo] : []),
      ].filter(Boolean);
      const sentAt =
        message.internalDate instanceof Date
          ? message.internalDate.toISOString()
          : typeof message.internalDate === "string"
            ? new Date(message.internalDate).toISOString()
            : new Date().toISOString();

      messages.push({
        externalMessageId,
        externalThreadId:
          parsed.inReplyTo?.trim() ||
          parsed.references?.[parsed.references.length - 1]?.trim() ||
          externalMessageId,
        subject,
        snippet: extractSnippet(bodyText || subject),
        bodyText,
        fromAddress,
        fromName,
        toAddress,
        sentAt,
        references,
      });
    }

    return messages.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  } finally {
    await client.logout().catch(() => undefined);
  }
}
