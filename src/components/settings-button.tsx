import Link from "next/link";
import { t } from "@/lib/copy";
import type { UiLanguage } from "@/lib/ui-settings-shared";

export function SettingsButton({ language }: { language: UiLanguage }) {
  return (
    <Link
      href="/settings"
      aria-label={t(language, "openSettings")}
      title={t(language, "settings")}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-white/80 text-slate-900 transition hover:bg-white"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5">
        <path
          d="M10.5 3.5h3l.6 2.3a6.8 6.8 0 0 1 1.8.8l2-1.1 2.1 2.1-1.1 2a6.8 6.8 0 0 1 .8 1.8l2.3.6v3l-2.3.6a6.8 6.8 0 0 1-.8 1.8l1.1 2-2.1 2.1-2-1.1a6.8 6.8 0 0 1-1.8.8l-.6 2.3h-3l-.6-2.3a6.8 6.8 0 0 1-1.8-.8l-2 1.1-2.1-2.1 1.1-2a6.8 6.8 0 0 1-.8-1.8L3.5 13.5v-3l2.3-.6a6.8 6.8 0 0 1 .8-1.8l-1.1-2 2.1-2.1 2 1.1a6.8 6.8 0 0 1 1.8-.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
        <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </Link>
  );
}
