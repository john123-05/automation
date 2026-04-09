"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UiLanguage } from "@/lib/ui-settings-shared";

const defaultState = {
  email: "",
  displayName: "",
  dailyLimit: "100",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUsername: "",
  smtpPassword: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
};

export function ManualMailboxConnectForm({ language = "en" }: { language?: UiLanguage }) {
  const router = useRouter();
  const [state, setState] = useState(defaultState);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-[28px] border border-line bg-white/80 p-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">SMTP + IMAP</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">
          {language === "de" ? "Mailbox manuell verbinden" : "Manual mailbox connect"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {language === "de"
            ? "Am besten für Nicht-Google-Postfächer oder eigene Versanddomains. SMTP wird für den Versand genutzt, IMAP wird mit der Mailbox gespeichert."
            : "Best for non-Google inboxes or custom sending domains. SMTP is used for sending, IMAP is stored with the mailbox."}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">
            {language === "de" ? "E-Mail-Adresse" : "Email address"}
          </span>
          <input
            value={state.email}
            onChange={(event) => setState((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            placeholder="hello@yourdomain.com"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">
            {language === "de" ? "Anzeigename" : "Display name"}
          </span>
          <input
            value={state.displayName}
            onChange={(event) => setState((current) => ({ ...current, displayName: event.target.value }))}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            placeholder="John"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">
            {language === "de" ? "Tageslimit" : "Daily limit"}
          </span>
          <input
            value={state.dailyLimit}
            onChange={(event) => setState((current) => ({ ...current, dailyLimit: event.target.value }))}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            inputMode="numeric"
            placeholder="100"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[24px] border border-line bg-slate-50/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {language === "de" ? "SMTP-Versand" : "SMTP sending"}
          </p>
          <div className="mt-4 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de" ? "SMTP-Host" : "SMTP host"}
              </span>
              <input
                value={state.smtpHost}
                onChange={(event) => setState((current) => ({ ...current, smtpHost: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="smtp.gmail.com"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-800">
                  {language === "de" ? "Port" : "Port"}
                </span>
                <input
                  value={state.smtpPort}
                  onChange={(event) => setState((current) => ({ ...current, smtpPort: event.target.value }))}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  inputMode="numeric"
                  placeholder="587"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={state.smtpSecure}
                  onChange={(event) => setState((current) => ({ ...current, smtpSecure: event.target.checked }))}
                />
                {language === "de" ? "Sichere Verbindung nutzen" : "Use secure connection"}
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de" ? "SMTP-Benutzername" : "SMTP username"}
              </span>
              <input
                value={state.smtpUsername}
                onChange={(event) => setState((current) => ({ ...current, smtpUsername: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="hello@yourdomain.com"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de"
                  ? "SMTP-Passwort / App-Passwort"
                  : "SMTP password / app password"}
              </span>
              <input
                type="password"
                value={state.smtpPassword}
                onChange={(event) => setState((current) => ({ ...current, smtpPassword: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="••••••••"
              />
            </label>
          </div>
        </div>

        <div className="rounded-[24px] border border-line bg-slate-50/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {language === "de" ? "IMAP-Postfach" : "IMAP inbox"}
          </p>
          <div className="mt-4 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de" ? "IMAP-Host" : "IMAP host"}
              </span>
              <input
                value={state.imapHost}
                onChange={(event) => setState((current) => ({ ...current, imapHost: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="imap.gmail.com"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-800">
                  {language === "de" ? "Port" : "Port"}
                </span>
                <input
                  value={state.imapPort}
                  onChange={(event) => setState((current) => ({ ...current, imapPort: event.target.value }))}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  inputMode="numeric"
                  placeholder="993"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={state.imapSecure}
                  onChange={(event) => setState((current) => ({ ...current, imapSecure: event.target.checked }))}
                />
                {language === "de" ? "Sichere Verbindung nutzen" : "Use secure connection"}
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de" ? "IMAP-Benutzername" : "IMAP username"}
              </span>
              <input
                value={state.imapUsername}
                onChange={(event) => setState((current) => ({ ...current, imapUsername: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="hello@yourdomain.com"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">
                {language === "de"
                  ? "IMAP-Passwort / App-Passwort"
                  : "IMAP password / app password"}
              </span>
              <input
                type="password"
                value={state.imapPassword}
                onChange={(event) => setState((current) => ({ ...current, imapPassword: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                placeholder={language === "de" ? "optional, aber empfohlen" : "optional but recommended"}
              />
            </label>
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
              const response = await fetch("/api/mailboxes/manual/connect", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  email: state.email,
                  displayName: state.displayName,
                  dailyLimit: state.dailyLimit,
                  smtpHost: state.smtpHost,
                  smtpPort: state.smtpPort,
                  smtpSecure: state.smtpSecure,
                  smtpUsername: state.smtpUsername,
                  smtpPassword: state.smtpPassword,
                  imapHost: state.imapHost,
                  imapPort: state.imapPort,
                  imapSecure: state.imapSecure,
                  imapUsername: state.imapUsername,
                  imapPassword: state.imapPassword,
                }),
              });
              const payload = (await response.json()) as { ok: boolean; error?: string };

              if (!response.ok || !payload.ok) {
                setMessage(
                  payload.error ?? (language === "de" ? "Mailbox-Verbindung fehlgeschlagen." : "Mailbox connect failed."),
                );
                return;
              }

              setState(defaultState);
              setMessage(language === "de" ? "Mailbox verbunden." : "Mailbox connected.");
              router.refresh();
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? language === "de"
              ? "Speichern..."
              : "Saving..."
            : language === "de"
              ? "SMTP + IMAP verbinden"
              : "Connect SMTP + IMAP"}
        </button>
        {message ? (
          <p
            className={`text-sm ${
              message === "Mailbox connected." || message === "Mailbox verbunden."
                ? "text-emerald-700"
                : "text-danger"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
