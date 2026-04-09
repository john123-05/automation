import type { ConnectedMailbox } from "@/lib/sales-machine/types";

export type GmailMailboxToken = {
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
};

export type SmtpMailboxConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

export type ImapMailboxConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

export type ManualMailboxConfig = {
  smtp: SmtpMailboxConfig;
  imap: ImapMailboxConfig | null;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function getGmailMailboxToken(mailbox: ConnectedMailbox): GmailMailboxToken {
  const data = asRecord(mailbox.oauthData);

  return {
    accessToken: typeof data?.accessToken === "string" ? data.accessToken : undefined,
    refreshToken: typeof data?.refreshToken === "string" ? data.refreshToken : null,
    expiresAt: typeof data?.expiresAt === "string" ? data.expiresAt : null,
  };
}

export function getManualMailboxConfig(mailbox: ConnectedMailbox): ManualMailboxConfig | null {
  const data = asRecord(mailbox.oauthData);
  const smtp = asRecord(data?.smtp);

  if (!smtp) {
    return null;
  }

  const smtpHost = typeof smtp.host === "string" ? smtp.host : null;
  const smtpPort = typeof smtp.port === "number" ? smtp.port : null;
  const smtpSecure = typeof smtp.secure === "boolean" ? smtp.secure : null;
  const smtpUsername = typeof smtp.username === "string" ? smtp.username : null;
  const smtpPassword = typeof smtp.password === "string" ? smtp.password : null;

  if (!smtpHost || !smtpPort || smtpSecure == null || !smtpUsername || !smtpPassword) {
    return null;
  }

  const imap = asRecord(data?.imap);
  const imapConfig =
    imap &&
    typeof imap.host === "string" &&
    typeof imap.port === "number" &&
    typeof imap.secure === "boolean" &&
    typeof imap.username === "string" &&
    typeof imap.password === "string"
      ? {
          host: imap.host,
          port: imap.port,
          secure: imap.secure,
          username: imap.username,
          password: imap.password,
        }
      : null;

  return {
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      username: smtpUsername,
      password: smtpPassword,
    },
    imap: imapConfig,
  };
}

export function getMailboxProviderLabel(mailbox: ConnectedMailbox) {
  return mailbox.provider === "gmail" ? "Google Auth" : "SMTP + IMAP";
}

export function mailboxSupportsInboxSync(mailbox: ConnectedMailbox) {
  if (mailbox.provider === "gmail") {
    return true;
  }

  return Boolean(getManualMailboxConfig(mailbox)?.imap);
}
