import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { notifyServerIssue } from "@/lib/system-alerts";
import {
  getGmailMailboxToken,
  getManualMailboxConfig,
} from "@/lib/sales-machine/mailbox-config";
import {
  decodeGmailBody,
  getGmailThread,
  listGmailThreads,
  refreshGoogleAccessToken,
} from "@/lib/sales-machine/gmail";
import { listImapInboxMessages } from "@/lib/sales-machine/imap";
import { sendInboxTelegramAlert } from "@/lib/telegram";
import { maybeSuppressBounceRecipient } from "@/lib/sales-machine/campaigns";
import { syncOpportunityFromOutreachStateInDb } from "@/lib/sales-machine/agency-os";
import { mutateDb, readDb } from "@/lib/sales-machine/store";
import { nowIso, serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

async function ensureGmailAccessToken(mailboxId: string) {
  const env = getEnv();
  const db = await readDb();
  const mailbox = db.connectedMailboxes.find((candidate) => candidate.id === mailboxId);

  if (!mailbox) {
    throw new Error("Mailbox not found.");
  }

  if (mailbox.status !== "connected") {
    throw new Error("Mailbox is not connected.");
  }

  if (mailbox.provider !== "gmail") {
    throw new Error("Inbox sync currently supports Google-auth or IMAP-configured mailboxes only.");
  }

  const oauth = getGmailMailboxToken(mailbox);

  if (
    oauth.accessToken &&
    (!oauth.expiresAt || new Date(oauth.expiresAt).getTime() > Date.now() + 60_000)
  ) {
    return {
      mailbox,
      accessToken: oauth.accessToken,
    };
  }

  if (
    !oauth.refreshToken ||
    !env.googleOauthClientId ||
    !env.googleOauthClientSecret ||
    !env.googleOauthRedirectUri
  ) {
    throw new Error("Mailbox access token is unavailable and cannot be refreshed.");
  }

  const refreshed = await refreshGoogleAccessToken(
    {
      clientId: env.googleOauthClientId,
      clientSecret: env.googleOauthClientSecret,
      redirectUri: env.googleOauthRedirectUri,
      appUrl: env.appUrl,
    },
    oauth.refreshToken,
  );

  await mutateDb((state) => {
    const target = state.connectedMailboxes.find((candidate) => candidate.id === mailboxId);

    if (!target) {
      return;
    }

    target.oauthData = {
      ...target.oauthData,
      accessToken: refreshed.access_token,
      refreshToken: oauth.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    target.updatedAt = nowIso();
  });

  return {
    mailbox,
    accessToken: refreshed.access_token,
  };
}

function headerValue(
  headers: Array<{ name: string; value: string }> | undefined,
  key: string,
) {
  return headers?.find((header) => header.name.toLowerCase() === key.toLowerCase())?.value ?? null;
}

function extractEmailAddress(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? value;
}

function normalizeMessageId(value: string | null | undefined) {
  return value?.trim().replace(/[<>]/g, "") || null;
}

function findThreadForInboundMessage(input: {
  state: Awaited<ReturnType<typeof readDb>>;
  mailboxId: string;
  remoteThreadId: string;
  references: string[];
  subject: string;
  contactEmail: string | null;
}) {
  const normalizedRemoteThreadId = normalizeMessageId(input.remoteThreadId);
  const referencedIds = new Set(
    input.references.map((value) => normalizeMessageId(value)).filter(Boolean) as string[],
  );
  const normalizedSubject = input.subject.trim().toLowerCase();
  const normalizedContactEmail = input.contactEmail?.trim().toLowerCase() ?? null;

  const matchedByReference = input.state.emailMessages.find((message) => {
    const externalMessageId = normalizeMessageId(message.externalMessageId);
    return externalMessageId ? referencedIds.has(externalMessageId) : false;
  });

  if (matchedByReference) {
    return (
      input.state.emailThreads.find((thread) => thread.id === matchedByReference.threadId) ?? null
    );
  }

  const matchedByExternalThread = input.state.emailThreads.find((thread) => {
    const externalThreadId = normalizeMessageId(thread.externalThreadId);
    return (
      thread.mailboxId === input.mailboxId &&
      Boolean(
        externalThreadId &&
          normalizedRemoteThreadId &&
          externalThreadId === normalizedRemoteThreadId,
      )
    );
  });

  if (matchedByExternalThread) {
    return matchedByExternalThread;
  }

  return (
    input.state.emailThreads.find((thread) => {
      const threadContactEmail = thread.contactEmail?.trim().toLowerCase() ?? null;

      return (
        thread.mailboxId === input.mailboxId &&
        thread.subject.trim().toLowerCase() === normalizedSubject &&
        threadContactEmail !== null &&
        normalizedContactEmail !== null &&
        threadContactEmail === normalizedContactEmail
      );
    }) ?? null
  );
}

async function upsertInboundMessage(input: {
  mailboxId: string;
  remoteThreadId: string;
  remoteMessageId: string;
  subject: string;
  body: string;
  snippet: string;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  sentAt: string;
  references?: string[];
}) {
  let syncedMessage = false;
  let syncedThreadId: string | null = null;

  await mutateDb((state) => {
    const existingThread = findThreadForInboundMessage({
      state,
      mailboxId: input.mailboxId,
      remoteThreadId: input.remoteThreadId,
      references: input.references ?? [],
      subject: input.subject,
      contactEmail: extractEmailAddress(input.fromAddress),
    });
    const normalizedThreadId = normalizeMessageId(input.remoteThreadId) ?? crypto.randomUUID();
    const threadId = existingThread?.id ?? `thread_${input.mailboxId}_${normalizedThreadId}`;
    syncedThreadId = threadId;

    const threadPayload = {
      id: threadId,
      campaignId: existingThread?.campaignId ?? null,
      mailboxId: input.mailboxId,
      leadId: existingThread?.leadId ?? null,
      serviceKey: existingThread?.serviceKey ?? null,
      sequenceId: existingThread?.sequenceId ?? null,
      externalThreadId: normalizedThreadId,
      subject: input.subject,
      snippet: input.snippet || input.body.slice(0, 180),
      contactName: existingThread?.contactName ?? input.fromName ?? null,
      contactEmail:
        existingThread?.contactEmail ??
        extractEmailAddress(input.fromAddress) ??
        extractEmailAddress(input.toAddress),
      state: "replied" as const,
      lastMessageAt: input.sentAt,
      createdAt: existingThread?.createdAt ?? input.sentAt,
      updatedAt: nowIso(),
    };

    if (existingThread) {
      Object.assign(existingThread, threadPayload);
    } else {
      state.emailThreads.push(threadPayload);
    }

    const normalizedMessageId = normalizeMessageId(input.remoteMessageId) ?? input.remoteMessageId;
    const existingMessage = state.emailMessages.find(
      (candidate) => normalizeMessageId(candidate.externalMessageId) === normalizedMessageId,
    );

    if (!existingMessage) {
      state.emailMessages.push({
        id: `message_${normalizedMessageId}`,
        threadId,
        mailboxId: input.mailboxId,
        externalMessageId: normalizedMessageId,
        direction: "inbound",
        status: "received",
        subject: input.subject,
        bodyText: input.body,
        fromAddress: extractEmailAddress(input.fromAddress),
        toAddress: extractEmailAddress(input.toAddress),
        sentAt: input.sentAt,
        createdAt: input.sentAt,
      });
      syncedMessage = true;
    }

    if (existingThread?.sequenceId) {
      const outreachState = state.outreachStates.find(
        (candidate) => candidate.sequenceId === existingThread.sequenceId,
      );

      if (outreachState) {
        outreachState.state = "replied";
        outreachState.threadId = threadId;
        outreachState.lastActivityAt = input.sentAt;
        outreachState.updatedAt = nowIso();
      }

      const sequence = state.generatedSequences.find(
        (candidate) => candidate.id === existingThread.sequenceId,
      );

      if (sequence) {
        sequence.state = "replied";
        sequence.updatedAt = nowIso();
      }

      const campaignLead = state.campaignLeads.find(
        (candidate) => candidate.sequenceId === existingThread.sequenceId,
      );

      if (campaignLead) {
        campaignLead.status = "replied";
        campaignLead.updatedAt = nowIso();
      }

      if (existingThread.serviceKey) {
        syncOpportunityFromOutreachStateInDb(state, {
          leadId:
            existingThread.leadId ??
            outreachState?.leadId ??
            sequence?.leadId ??
            campaignLead?.leadId ??
            "",
          serviceKey: existingThread.serviceKey,
          state: "replied",
          campaignId: existingThread.campaignId,
          contactId: campaignLead?.contactId ?? null,
          occurredAt: input.sentAt,
        });
      }
    }
  });

  await maybeSuppressBounceRecipient({
    toAddress: extractEmailAddress(input.toAddress),
    fromAddress: extractEmailAddress(input.fromAddress),
    subject: input.subject,
  });

  return { syncedMessage, threadId: syncedThreadId };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mailboxId = url.searchParams.get("mailboxId");
    const db = await readDb();
    const mailboxes = mailboxId
      ? db.connectedMailboxes.filter((mailbox) => mailbox.id === mailboxId)
      : db.connectedMailboxes.filter((mailbox) => {
          if (mailbox.status !== "connected") {
            return false;
          }

          if (mailbox.provider === "gmail") {
            return true;
          }

          return Boolean(getManualMailboxConfig(mailbox)?.imap);
        });

    if (!mailboxes.length) {
      return NextResponse.json({
        ok: true,
        syncedThreads: 0,
        syncedMessages: 0,
      });
    }

    let syncedThreads = 0;
    let syncedMessages = 0;

    for (const mailbox of mailboxes) {
      if (mailbox.provider === "gmail") {
        const auth = await ensureGmailAccessToken(mailbox.id);
        const threadList = await listGmailThreads({
          accessToken: auth.accessToken,
          maxResults: 10,
        });

        for (const threadRef of threadList.threads ?? []) {
          const remoteThread = await getGmailThread(auth.accessToken, threadRef.id);
          const latestMessage = remoteThread.messages?.[remoteThread.messages.length - 1];

          if (!latestMessage) {
            continue;
          }

          const headers = latestMessage.payload?.headers;
          const fromAddress = headerValue(headers, "From");
          const toAddress = headerValue(headers, "To");
          const subject = headerValue(headers, "Subject") ?? "(no subject)";
          const body =
            decodeGmailBody(latestMessage.payload?.body?.data) ||
            decodeGmailBody(
              latestMessage.payload?.parts?.find((part) => part.mimeType === "text/plain")?.body
                ?.data,
            ) ||
            latestMessage.snippet ||
            "";
          const internalDate = latestMessage.internalDate
            ? new Date(Number(latestMessage.internalDate)).toISOString()
            : nowIso();
          const incoming = !fromAddress?.includes(mailbox.email);

          if (incoming) {
            const result = await upsertInboundMessage({
              mailboxId: mailbox.id,
              remoteThreadId: remoteThread.id,
              remoteMessageId: latestMessage.id,
              subject,
              body,
              snippet: remoteThread.snippet ?? threadRef.snippet ?? body.slice(0, 180),
              fromAddress,
              fromName: null,
              toAddress,
              sentAt: internalDate,
              references: [
                headerValue(headers, "In-Reply-To"),
                ...(headerValue(headers, "References")?.split(/\s+/) ?? []),
              ].filter(Boolean) as string[],
            });

            if (result.syncedMessage) {
              syncedMessages += 1;
              try {
                await sendInboxTelegramAlert({
                  mailboxEmail: mailbox.email,
                  fromAddress,
                  subject,
                  body,
                  sentAt: internalDate,
                  threadId: result.threadId ?? remoteThread.id,
                });
              } catch (error) {
                console.error("Telegram inbox alert failed.", error);
              }
            }
          }

          syncedThreads += 1;
        }

        continue;
      }

      const manualConfig = getManualMailboxConfig(mailbox);

      if (!manualConfig?.imap) {
        if (mailboxId === mailbox.id) {
          throw new Error("IMAP is not configured for this mailbox yet.");
        }

        continue;
      }

      const remoteMessages = await listImapInboxMessages({
        config: manualConfig.imap,
        maxMessages: 20,
      });

      for (const message of remoteMessages) {
        const result = await upsertInboundMessage({
          mailboxId: mailbox.id,
          remoteThreadId: message.externalThreadId,
          remoteMessageId: message.externalMessageId,
          subject: message.subject,
          body: message.bodyText,
          snippet: message.snippet,
          fromAddress: message.fromAddress,
          fromName: message.fromName,
          toAddress: message.toAddress,
          sentAt: message.sentAt,
          references: message.references,
        });

        if (result.syncedMessage) {
          syncedMessages += 1;
          try {
            await sendInboxTelegramAlert({
              mailboxEmail: mailbox.email,
              fromAddress: message.fromAddress,
              subject: message.subject,
              body: message.bodyText,
              sentAt: message.sentAt,
              threadId: result.threadId ?? message.externalThreadId,
            });
          } catch (error) {
            console.error("Telegram inbox alert failed.", error);
          }
        }

        syncedThreads += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      syncedThreads,
      syncedMessages,
    });
  } catch (error) {
    await notifyServerIssue({
      source: "api/inbox/sync",
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
