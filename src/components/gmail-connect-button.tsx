"use client";

import { useState, useTransition } from "react";
import type { UiLanguage } from "@/lib/ui-settings-shared";

export function GmailConnectButton({ language = "en" }: { language?: UiLanguage }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const response = await fetch("/api/mailboxes/google/connect", {
              method: "POST",
            });
            const payload = (await response.json()) as {
              ok: boolean;
              authUrl?: string;
              error?: string;
            };

            if (!response.ok || !payload.ok || !payload.authUrl) {
              setMessage(payload.error ?? "Google OAuth is not ready.");
              return;
            }

            window.location.href = payload.authUrl;
          });
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (language === "de" ? "Google wird geöffnet..." : "Opening Google...") : language === "de" ? "Gmail verbinden" : "Connect Gmail"}
      </button>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}
