import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { appAccessSessionCookieName } from "@/lib/app-auth-shared";

function getAppAccessPassword() {
  const value = process.env.APP_ACCESS_PASSWORD?.trim();
  return value ? value : null;
}

export function isAppAuthEnabled() {
  return Boolean(getAppAccessPassword());
}

export function createAppAccessSessionValue(password: string) {
  return createHash("sha256").update(`fieldflow:${password}`).digest("hex");
}

export function isAppPasswordValid(password: string) {
  const expectedPassword = getAppAccessPassword();
  return Boolean(expectedPassword && password === expectedPassword);
}

export function getAppAccessCookieValue() {
  const password = getAppAccessPassword();
  return password ? createAppAccessSessionValue(password) : null;
}

export function getAppAccessCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function hasAppAccess() {
  const expectedCookieValue = getAppAccessCookieValue();

  if (!expectedCookieValue) {
    return true;
  }

  const cookieStore = await cookies();
  const actualCookieValue = cookieStore.get(appAccessSessionCookieName)?.value;

  return actualCookieValue === expectedCookieValue;
}
