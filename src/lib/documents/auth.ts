import "server-only";

import { createHash } from "node:crypto";

export const documentsSessionCookieName = "documents_access";

function getDocumentsAccessPassword() {
  const value = process.env.DOCUMENTS_ACCESS_PASSWORD?.trim();
  return value ? value : null;
}

function createDocumentsSessionValue(password: string) {
  return createHash("sha256").update(`documents:${password}`).digest("hex");
}

export function isDocumentsAuthEnabled() {
  return Boolean(getDocumentsAccessPassword());
}

export function isDocumentsPasswordValid(password: string) {
  const expectedPassword = getDocumentsAccessPassword();
  return Boolean(expectedPassword && password === expectedPassword);
}

export function getDocumentsSessionCookieValue() {
  const password = getDocumentsAccessPassword();
  return password ? createDocumentsSessionValue(password) : null;
}

export function getDocumentsSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function hasDocumentsAccess() {
  const expectedCookieValue = getDocumentsSessionCookieValue();

  if (!expectedCookieValue) {
    return true;
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const actualCookieValue = cookieStore.get(documentsSessionCookieName)?.value;

    return actualCookieValue === expectedCookieValue;
  } catch {
    return false;
  }
}
