import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const language: UiLanguage =
    cookieStore.get(uiLanguageCookieName)?.value === "de" ? "de" : "en";
  const theme: UiTheme = cookieStore.get(uiThemeCookieName)?.value === "dark" ? "dark" : "light";

  return { language, theme };
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
