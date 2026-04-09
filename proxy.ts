import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { appAccessSessionCookieName } from "@/lib/app-auth-shared";

function isAppAuthEnabled() {
  const value = process.env.APP_ACCESS_PASSWORD?.trim();
  return Boolean(value);
}

async function createExpectedSessionValue(password: string) {
  const encoded = new TextEncoder().encode(`fieldflow:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isExcludedPath(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap")
  );
}

export async function proxy(request: NextRequest) {
  if (!isAppAuthEnabled() || isExcludedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const password = process.env.APP_ACCESS_PASSWORD?.trim();

  if (!password) {
    return NextResponse.next();
  }

  const expectedSessionValue = await createExpectedSessionValue(password);
  const actualSessionValue = request.cookies.get(appAccessSessionCookieName)?.value;
  const isAuthenticated = actualSessionValue === expectedSessionValue;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthenticated || isLoginPage) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath && nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
