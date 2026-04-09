import { getEnv } from "@/lib/env";
import { getGmailMailboxToken, getManualMailboxConfig } from "@/lib/sales-machine/mailbox-config";
import { refreshGoogleAccessToken, sendGmailMessage } from "@/lib/sales-machine/gmail";
import { mutateDb, readDb } from "@/lib/sales-machine/store";
import { nowIso } from "@/lib/sales-machine/utils";
import nodemailer from "nodemailer";

type ManualMessageInput = {
  mailboxId: string;
  threadId?: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
};

function extractDomain(email: string | null | undefined) {
  if (!email || !email.includes("@")) {
    return null;
  }

  return email.split("@")[1]?.toLowerCase() ?? null;
}

type ResolvedMailboxConnection =
  | {
      provider: "gmail";
      mailboxId: string;
      email: string;
      displayName: string | null;
      threadSafeToken: string;
    }
  | {
      provider: "smtp";
      mailboxId: string;
      email: string;
      displayName: string | null;
      smtp: NonNullable<ReturnType<typeof getManualMailboxConfig>>["smtp"];
    };

async function ensureMailboxConnection(
  mailboxId: string,
): Promise<ResolvedMailboxConnection> {
  const env = getEnv();
  const db = await readDb();
  const mailbox = db.connectedMailboxes.find((candidate) => candidate.id === mailboxId);

  if (!mailbox) {
    throw new Error("Mailbox was not found.");
  }

  if (mailbox.status !== "connected") {
    throw new Error("Mailbox is not connected yet.");
  }

  if (mailbox.provider === "smtp") {
    const manualConfig = getManualMailboxConfig(mailbox);

    if (!manualConfig) {
      throw new Error("SMTP mailbox settings are incomplete.");
    }

    return {
      provider: "smtp",
      mailboxId: mailbox.id,
      email: mailbox.email,
      displayName: mailbox.displayName,
      smtp: manualConfig.smtp,
    };
  }

  const oauth = getGmailMailboxToken(mailbox);
  const accessToken = typeof oauth.accessToken === "string" ? oauth.accessToken : null;
  const refreshToken = typeof oauth.refreshToken === "string" ? oauth.refreshToken : null;
  const expiresAt = typeof oauth.expiresAt === "string" ? oauth.expiresAt : null;

  if (accessToken && (!expiresAt || new Date(expiresAt).getTime() > Date.now() + 60_000)) {
    return {
      provider: "gmail",
      mailboxId: mailbox.id,
      email: mailbox.email,
      displayName: mailbox.displayName,
      threadSafeToken: accessToken,
    };
  }

  if (
    !refreshToken ||
    !env.googleOauthClientId ||
    !env.googleOauthClientSecret ||
    !env.googleOauthRedirectUri
  ) {
    throw new Error("Mailbox access token expired and Google OAuth refresh is not configured.");
  }

  const refreshed = await refreshGoogleAccessToken(
    {
      clientId: env.googleOauthClientId,
      clientSecret: env.googleOauthClientSecret,
      redirectUri: env.googleOauthRedirectUri,
      appUrl: env.appUrl,
    },
    refreshToken,
  );

  await mutateDb((state) => {
    const targetMailbox = state.connectedMailboxes.find((candidate) => candidate.id === mailboxId);

    if (!targetMailbox) {
      return;
    }

    targetMailbox.oauthData = {
      ...targetMailbox.oauthData,
      accessToken: refreshed.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    targetMailbox.updatedAt = nowIso();
  });

  return {
    provider: "gmail",
    mailboxId: mailbox.id,
    email: mailbox.email,
    displayName: mailbox.displayName,
    threadSafeToken: refreshed.access_token,
  };
}

async function sendSmtpMessage(input: {
  smtp: NonNullable<ReturnType<typeof getManualMailboxConfig>>["smtp"];
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  threadId?: string | null;
}) {
  const sendMail = async (secure: boolean) => {
    const transporter = nodemailer.createTransport({
      host: input.smtp.host,
      port: input.smtp.port,
      secure,
      requireTLS: !secure,
      auth: {
        user: input.smtp.username,
        pass: input.smtp.password,
      },
    });

    return transporter.sendMail({
      from: input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail,
      to: input.toEmail,
      subject: input.subject,
      text: input.bodyText,
      ...(input.threadId
        ? {
            inReplyTo: input.threadId,
            references: input.threadId,
          }
        : {}),
    });
  };

  let result;

  try {
    result = await sendMail(input.smtp.secure);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isTlsModeMismatch =
      message.includes("wrong version number") ||
      message.includes("tlsv1 alert") ||
      message.includes("ssl routines") ||
      message.includes("unexpected tls packet");

    if (!isTlsModeMismatch) {
      throw error;
    }

    // Common provider mismatch: port 587 usually wants STARTTLS (`secure: false`),
    // while port 465 usually wants implicit TLS (`secure: true`).
    result = await sendMail(!input.smtp.secure);
  }

  return {
    id: result.messageId,
    threadId: input.threadId ?? result.messageId,
  };
}

async function assertMailboxCapacity(mailboxId: string) {
  const db = await readDb();
  const mailbox = db.connectedMailboxes.find((candidate) => candidate.id === mailboxId);

  if (!mailbox) {
    throw new Error("Mailbox was not found.");
  }

  if (!mailbox.dailyLimit) {
    return;
  }

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todaysSent = db.emailMessages.filter(
    (message) =>
      message.mailboxId === mailboxId &&
      message.direction === "outbound" &&
      message.status === "sent" &&
      Boolean(message.sentAt) &&
      String(message.sentAt) >= startOfDay,
  ).length;

  if (todaysSent >= mailbox.dailyLimit) {
    throw new Error(`Mailbox daily limit reached for ${mailbox.email}.`);
  }
}

async function assertRecipientAllowed(email: string) {
  const db = await readDb();
  const normalizedEmail = email.toLowerCase();
  const domain = extractDomain(normalizedEmail);
  const match = db.suppressionEntries.find(
    (entry) => entry.email?.toLowerCase() === normalizedEmail || (domain && entry.domain === domain),
  );

  if (match) {
    throw new Error(`Recipient is suppressed: ${match.reason}.`);
  }
}

export async function addSuppressionEntry(input: {
  email?: string | null;
  domain?: string | null;
  reason: string;
  source: "manual" | "bounce" | "reply" | "system";
}) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const normalizedDomain = input.domain?.trim().toLowerCase() || extractDomain(normalizedEmail) || null;

  return mutateDb((db) => {
    const existing = db.suppressionEntries.find(
      (entry) =>
        (normalizedEmail && entry.email?.toLowerCase() === normalizedEmail) ||
        (normalizedDomain && entry.domain?.toLowerCase() === normalizedDomain),
    );

    if (existing) {
      return existing;
    }

    const payload = {
      id: `suppression_${normalizedEmail ?? normalizedDomain ?? Date.now().toString()}`,
      email: normalizedEmail,
      domain: normalizedDomain,
      reason: input.reason,
      source: input.source,
      createdAt: nowIso(),
    } as const;

    db.suppressionEntries.push(payload);
    return payload;
  });
}

export async function sendSequenceStep(sequenceId: string, stepNumber: number) {
  const db = await readDb();
  const sequence = db.generatedSequences.find((candidate) => candidate.id === sequenceId);

  if (!sequence) {
    throw new Error("Sequence was not found.");
  }

  if (!sequence.mailboxId) {
    throw new Error("Assign a connected mailbox before sending a sequence step.");
  }

  if (sequence.state !== "approved" && sequence.state !== "scheduled") {
    throw new Error("Sequence must be approved before sending.");
  }

  const lead = db.leads.find((candidate) => candidate.id === sequence.leadId);
  const contact = db.contacts
    .filter((candidate) => candidate.leadId === sequence.leadId && candidate.email)
    .sort((a, b) => (a.email ? 0 : 1) - (b.email ? 0 : 1))[0];
  const step = sequence.steps.find((candidate) => candidate.stepNumber === stepNumber);

  if (!lead || !contact?.email || !step) {
    throw new Error("The lead, contact email, or sequence step is missing.");
  }

  await assertRecipientAllowed(contact.email);
  await assertMailboxCapacity(sequence.mailboxId);

  const mailbox = await ensureMailboxConnection(sequence.mailboxId);
  const existingThread = db.emailThreads.find((candidate) => candidate.sequenceId === sequence.id);
  const sendResult =
    mailbox.provider === "gmail"
      ? await sendGmailMessage({
          accessToken: mailbox.threadSafeToken,
          fromEmail: mailbox.email,
          fromName: mailbox.displayName,
          toEmail: contact.email,
          subject: step.subject,
          bodyText: step.body,
          threadId: existingThread?.externalThreadId ?? null,
        })
      : await sendSmtpMessage({
          smtp: mailbox.smtp,
          fromEmail: mailbox.email,
          fromName: mailbox.displayName,
          toEmail: contact.email,
          subject: step.subject,
          bodyText: step.body,
          threadId: existingThread?.externalThreadId ?? null,
        });

  await mutateDb((state) => {
    const targetSequence = state.generatedSequences.find((candidate) => candidate.id === sequence.id);
    const targetCampaignLead = state.campaignLeads.find((candidate) => candidate.sequenceId === sequence.id);
    const targetExistingThread = existingThread
      ? state.emailThreads.find((candidate) => candidate.id === existingThread.id) ?? null
      : null;

    if (!targetSequence) {
      throw new Error("Sequence disappeared while sending.");
    }

    const targetStep = targetSequence.steps.find((candidate) => candidate.stepNumber === stepNumber);

    if (!targetStep) {
      throw new Error("Sequence step disappeared while sending.");
    }

    targetStep.sendState = "sent";
    targetStep.sentAt = nowIso();

    const remainingScheduledSteps = targetSequence.steps.filter(
      (candidate) => candidate.sendState === "scheduled",
    );

    targetSequence.state = remainingScheduledSteps.length ? "scheduled" : "sent";
    targetSequence.updatedAt = nowIso();

    const threadId = targetExistingThread?.id ?? `thread_${sequence.mailboxId}_${sendResult.threadId}`;
    const existingState = state.outreachStates.find(
      (candidate) =>
        candidate.sequenceId === sequence.id ||
        (candidate.leadId === sequence.leadId && candidate.serviceKey === sequence.serviceKey),
    );

    const threadPayload = {
      id: threadId,
      campaignId: sequence.campaignId,
      mailboxId: sequence.mailboxId as string,
      leadId: sequence.leadId,
      serviceKey: sequence.serviceKey,
      sequenceId: sequence.id,
      externalThreadId: sendResult.threadId,
      subject: step.subject,
      snippet: step.body.slice(0, 180),
      contactName: contact.name,
      contactEmail: contact.email,
      state: remainingScheduledSteps.length ? ("scheduled" as const) : ("sent" as const),
      lastMessageAt: nowIso(),
      createdAt: targetExistingThread?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    if (targetExistingThread) {
      Object.assign(targetExistingThread, threadPayload);
    } else {
      state.emailThreads.push(threadPayload);
    }

    state.emailMessages.push({
      id: `message_${sendResult.id}`,
      threadId,
      mailboxId: sequence.mailboxId as string,
      externalMessageId: sendResult.id,
      direction: "outbound",
      status: "sent",
      subject: step.subject,
      bodyText: step.body,
      fromAddress: mailbox.email,
      toAddress: contact.email,
      sentAt: nowIso(),
      createdAt: nowIso(),
    });

    if (existingState) {
      existingState.campaignId = sequence.campaignId;
      existingState.mailboxId = sequence.mailboxId;
      existingState.sequenceId = sequence.id;
      existingState.threadId = threadId;
      existingState.state = remainingScheduledSteps.length ? "scheduled" : "sent";
      existingState.nextStepNumber =
        targetSequence.steps.find((candidate) => candidate.sendState !== "sent")?.stepNumber ?? null;
      existingState.lastActivityAt = nowIso();
      existingState.updatedAt = nowIso();
    }

    if (targetCampaignLead) {
      targetCampaignLead.status = remainingScheduledSteps.length ? "scheduled" : "sent";
      targetCampaignLead.outreachStateId = existingState?.id ?? targetCampaignLead.outreachStateId;
      targetCampaignLead.updatedAt = nowIso();
    }
  });

  return {
    threadId: sendResult.threadId,
    messageId: sendResult.id,
  };
}

export async function sendManualMessage(input: ManualMessageInput) {
  await assertRecipientAllowed(input.toEmail);
  await assertMailboxCapacity(input.mailboxId);

  const mailbox = await ensureMailboxConnection(input.mailboxId);
  const db = await readDb();
  const existingThread = input.threadId
    ? db.emailThreads.find((candidate) => candidate.id === input.threadId)
    : null;
  const sendResult =
    mailbox.provider === "gmail"
      ? await sendGmailMessage({
          accessToken: mailbox.threadSafeToken,
          fromEmail: mailbox.email,
          fromName: mailbox.displayName,
          toEmail: input.toEmail,
          subject: input.subject,
          bodyText: input.bodyText,
          threadId: existingThread?.externalThreadId ?? null,
        })
      : await sendSmtpMessage({
          smtp: mailbox.smtp,
          fromEmail: mailbox.email,
          fromName: mailbox.displayName,
          toEmail: input.toEmail,
          subject: input.subject,
          bodyText: input.bodyText,
          threadId: existingThread?.externalThreadId ?? null,
        });

  await mutateDb((state) => {
    const targetExistingThread = existingThread
      ? state.emailThreads.find((candidate) => candidate.id === existingThread.id) ?? null
      : null;
    const threadId = targetExistingThread?.id ?? `thread_${input.mailboxId}_${sendResult.threadId}`;

    if (targetExistingThread) {
      targetExistingThread.subject = input.subject;
      targetExistingThread.snippet = input.bodyText.slice(0, 180);
      targetExistingThread.lastMessageAt = nowIso();
      targetExistingThread.updatedAt = nowIso();
    } else {
      state.emailThreads.push({
        id: threadId,
        campaignId: null,
        mailboxId: input.mailboxId,
        leadId: null,
        serviceKey: null,
        sequenceId: null,
        externalThreadId: sendResult.threadId,
        subject: input.subject,
        snippet: input.bodyText.slice(0, 180),
        contactName: null,
        contactEmail: input.toEmail,
        state: "sent",
        lastMessageAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    state.emailMessages.push({
      id: `message_${sendResult.id}`,
      threadId,
      mailboxId: input.mailboxId,
      externalMessageId: sendResult.id,
      direction: "outbound",
      status: "sent",
      subject: input.subject,
      bodyText: input.bodyText,
      fromAddress: mailbox.email,
      toAddress: input.toEmail,
      sentAt: nowIso(),
      createdAt: nowIso(),
    });
  });

  return {
    threadId: sendResult.threadId,
    messageId: sendResult.id,
  };
}
