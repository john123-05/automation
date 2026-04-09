import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { buildGoogleOauthUrl } from "@/lib/sales-machine/gmail";

export const runtime = "nodejs";

export async function POST() {
  const env = getEnv();

  if (!env.googleOauthClientId || !env.googleOauthClientSecret || !env.googleOauthRedirectUri) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Google OAuth is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
      },
      { status: 400 },
    );
  }

  const oauth = buildGoogleOauthUrl({
    clientId: env.googleOauthClientId,
    clientSecret: env.googleOauthClientSecret,
    redirectUri: env.googleOauthRedirectUri,
    appUrl: env.appUrl,
  });

  return NextResponse.json({
    ok: true,
    authUrl: oauth.url,
    state: oauth.state,
  });
}
