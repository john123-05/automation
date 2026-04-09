"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { t } from "@/lib/copy";
import {
  uiLanguageCookieName,
  uiThemeCookieName,
  type UiLanguage,
  type UiTheme,
} from "@/lib/ui-settings-shared";

export function SettingsPreferencesForm({
  language,
  theme,
}: {
  language: UiLanguage;
  theme: UiTheme;
}) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<UiLanguage>(language);
  const [selectedTheme, setSelectedTheme] = useState<UiTheme>(theme);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  function applySettingsImmediately(nextLanguage: UiLanguage, nextTheme: UiTheme) {
    document.documentElement.lang = nextLanguage;
    document.documentElement.classList.remove("theme-light", "theme-dark");
    document.documentElement.classList.add(nextTheme === "dark" ? "theme-dark" : "theme-light");
    document.cookie = `${uiLanguageCookieName}=${nextLanguage}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.cookie = `${uiThemeCookieName}=${nextTheme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <div className="glass-panel rounded-[32px] p-6">
      <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "interface")}</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t(language, "appSettings")}</h2>
      <p className="mt-3 text-sm text-slate-700">{t(language, "settingsIntro")}</p>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[24px] border border-line bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-950">{t(language, "language")}</p>
          <p className="mt-2 text-sm text-slate-600">{t(language, "languageDescription")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["de", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedLanguage(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedLanguage === option
                    ? "bg-slate-950 text-white"
                    : "border border-line bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {option === "de" ? t(language, "german") : t(language, "english")}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-line bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-950">{t(language, "theme")}</p>
          <p className="mt-2 text-sm text-slate-600">{t(language, "themeDescription")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["light", "dark"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedTheme(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedTheme === option
                    ? "bg-slate-950 text-white"
                    : "border border-line bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {option === "dark" ? t(language, "dark") : t(language, "light")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const response = await fetch("/api/settings", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  language: selectedLanguage,
                  theme: selectedTheme,
                }),
              });
              const payload = (await response.json()) as { ok: boolean; error?: string };

              if (!response.ok || !payload.ok) {
                setMessage(payload.error ?? t(language, "preferencesFailed"));
                return;
              }

              applySettingsImmediately(selectedLanguage, selectedTheme);
              setMessage(t(selectedLanguage, "preferencesSaved"));
              router.refresh();
              window.location.reload();
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "..." : t(language, "savePreferences")}
        </button>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
