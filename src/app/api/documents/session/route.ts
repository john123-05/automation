import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  documentsSessionCookieName,
  getDocumentsSessionCookieOptions,
  getDocumentsSessionCookieValue,
  isDocumentsAuthEnabled,
  isDocumentsPasswordValid,
} from "@/lib/documents/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeDocumentsRedirect(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.startsWith("/documents")) {
    return "/documents";
  }

  return rawValue;
}

function redirectWithSeeOther(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = getSafeDocumentsRedirect(formData.get("redirectTo"));
  const intent = typeof formData.get("intent") === "string" ? formData.get("intent") : null;
  const rawPassword = formData.get("password");
  const cookieStore = await cookies();

  if (intent === "logout") {
    cookieStore.delete(documentsSessionCookieName);
    return redirectWithSeeOther(new URL("/documents", request.url));
  }

  if (!isDocumentsAuthEnabled()) {
    return redirectWithSeeOther(new URL(redirectTo, request.url));
  }

  const passwordValue = typeof rawPassword === "string" ? rawPassword : "";

  if (!isDocumentsPasswordValid(passwordValue)) {
    const target = new URL(redirectTo, request.url);
    target.searchParams.set("authError", "invalid_password");

    return redirectWithSeeOther(target);
  }

  const sessionValue = getDocumentsSessionCookieValue();

  if (!sessionValue) {
    return redirectWithSeeOther(new URL(redirectTo, request.url));
  }

  cookieStore.set({
    name: documentsSessionCookieName,
    value: sessionValue,
    ...getDocumentsSessionCookieOptions(),
  });

  return redirectWithSeeOther(new URL(redirectTo, request.url));
}
