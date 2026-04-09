import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  buildOauthPayload,
  exchangeGoogleOauthCode,
  expiresAtFromNow,
  getGoogleUserProfile,
} from "@/lib/sales-machine/gmail";
import { mutateDb } from "@/lib/sales-machine/store";
import { createId, nowIso } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/outreach?mailboxError=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/outreach?mailboxError=missing_code", request.url),
    );
  }

  if (!env.googleOauthClientId || !env.googleOauthClientSecret || !env.googleOauthRedirectUri) {
    return NextResponse.redirect(
      new URL("/outreach?mailboxError=oauth_not_configured", request.url),
    );
  }

  try {
    const token = await exchangeGoogleOauthCode(
      {
        clientId: env.googleOauthClientId,
        clientSecret: env.googleOauthClientSecret,
        redirectUri: env.googleOauthRedirectUri,
        appUrl: env.appUrl,
      },
      code,
    );
    const profile = await getGoogleUserProfile(token.access_token);

    await mutateDb((db) => {
      const existing = db.connectedMailboxes.find(
        (candidate) => candidate.email.toLowerCase() === profile.email.toLowerCase(),
      );

      const payload = {
        id: existing?.id ?? createId("mailbox"),
        provider: "gmail" as const,
        email: profile.email,
        displayName: profile.name ?? null,
        status: "connected" as const,
        signature: existing?.signature ?? null,
        dailyLimit: existing?.dailyLimit ?? 100,
        oauthData: buildOauthPayload({
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? undefined,
          expiresAt: expiresAtFromNow(token.expires_in),
        }),
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };

      if (existing) {
        Object.assign(existing, payload);
      } else {
        db.connectedMailboxes.push(payload);
      }
    });

    return NextResponse.redirect(new URL("/outreach?mailboxConnected=1", request.url));
  } catch (callbackError) {
    return NextResponse.redirect(
      new URL(
        `/outreach?mailboxError=${encodeURIComponent(
          callbackError instanceof Error ? callbackError.message : "oauth_failed",
        )}`,
        request.url,
      ),
    );
  }
}
