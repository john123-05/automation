import { NextResponse } from "next/server";
import {
  appAccessSessionCookieName,
} from "@/lib/app-auth-shared";
import {
  getAppAccessCookieOptions,
  getAppAccessCookieValue,
  isAppAuthEnabled,
  isAppPasswordValid,
} from "@/lib/app-auth";

export const runtime = "nodejs";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!isAppAuthEnabled()) {
    return NextResponse.redirect(new URL(next, url), { status: 303 });
  }

  if (!isAppPasswordValid(password)) {
    const redirectUrl = new URL("/login", url);
    redirectUrl.searchParams.set("error", "1");

    if (next !== "/") {
      redirectUrl.searchParams.set("next", next);
    }

    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, url), { status: 303 });
  const sessionValue = getAppAccessCookieValue();

  if (sessionValue) {
    response.cookies.set(
      appAccessSessionCookieName,
      sessionValue,
      getAppAccessCookieOptions(),
    );
  }

  return response;
}
