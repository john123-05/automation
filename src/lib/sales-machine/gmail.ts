import { createId, nowIso } from "@/lib/sales-machine/utils";

const GMAIL_SCOPE = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export type GmailOauthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appUrl?: string | null;
};

export function buildGoogleOauthUrl(config: GmailOauthConfig) {
  const state = createId("gmail");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return {
    state,
    url: url.toString(),
  };
}

export async function exchangeGoogleOauthCode(config: GmailOauthConfig, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function refreshGoogleAccessToken(config: GmailOauthConfig, refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function getGoogleUserProfile(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google user profile lookup failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    email: string;
    name?: string;
    picture?: string;
    sub: string;
  };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendGmailMessage({
  accessToken,
  fromName,
  fromEmail,
  toEmail,
  subject,
  bodyText,
  threadId,
}: {
  accessToken: string;
  fromName?: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  threadId?: string | null;
}) {
  const headers = [
    `From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    bodyText,
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw: encodeBase64Url(headers),
      ...(threadId ? { threadId } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Gmail send failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    id: string;
    threadId: string;
    labelIds?: string[];
  };
}

export async function listGmailThreads({
  accessToken,
  maxResults = 20,
}: {
  accessToken: string;
  maxResults?: number;
}) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Gmail thread list failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    threads?: Array<{
      id: string;
      snippet?: string;
      historyId?: string;
    }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  };
}

export async function getGmailThread(accessToken: string, threadId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Gmail thread fetch failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as {
    id: string;
    snippet?: string;
    messages?: Array<{
      id: string;
      threadId: string;
      internalDate?: string;
      snippet?: string;
      labelIds?: string[];
      payload?: {
        headers?: Array<{
          name: string;
          value: string;
        }>;
        body?: {
          data?: string;
        };
        parts?: Array<{
          mimeType?: string;
          body?: {
            data?: string;
          };
        }>;
      };
    }>;
  };
}

export function decodeGmailBody(data: string | undefined) {
  if (!data) {
    return "";
  }

  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function expiresAtFromNow(expiresInSeconds: number) {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function buildOauthPayload(input: {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
}) {
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    expiresAt: input.expiresAt ?? nowIso(),
  };
}
