import {
  uiLanguageCookieName,
  uiThemeCookieName,
  type UiLanguage,
  type UiTheme,
} from "@/lib/ui-settings-shared";

export async function getUiSettings(): Promise<{
  language: UiLanguage;
  theme: UiTheme;
}> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const language: UiLanguage =
      cookieStore.get(uiLanguageCookieName)?.value === "de" ? "de" : "en";
    const theme: UiTheme =
      cookieStore.get(uiThemeCookieName)?.value === "dark" ? "dark" : "light";

    return { language, theme };
  } catch {
    // Some hosted dev environments fail to initialize Next's request store reliably.
    return {
      language: "en",
      theme: "light",
    };
  }
}

export function getUiSettingsCookieOptions() {
  return {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
