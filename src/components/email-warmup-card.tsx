"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateWarmupDaysLeft, formatWarmupTrialEndDate } from "@/lib/email-warmup-shared";
import type { UiLanguage } from "@/lib/ui-settings-shared";

type WarmupAccount = {
  id: string;
  email: string;
  trialEndsOn: string;
  createdAt: string;
};

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function EmailWarmupCard({
  initialAccounts,
  language,
}: {
  initialAccounts: WarmupAccount[];
  language: UiLanguage;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [trialEndsOn, setTrialEndsOn] = useState("2026-04-22");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const daysLeft = useMemo(() => {
    const latestTrialEnd = [...accounts]
      .map((account) => account.trialEndsOn)
      .sort()
      .at(-1);

    return latestTrialEnd ? calculateWarmupDaysLeft(latestTrialEnd) : null;
  }, [accounts]);

  const labels =
    language === "de"
      ? {
          title: "Email Warm Up",
          status: "Live",
          summary: `${daysLeft ?? 0} Tage bis Trial-Ende`,
          accounts: "Accounts",
          instantly: "Instantly.ai öffnen",
          addAccount: "Neuen Account hinzufügen",
          modalTitle: "Warmup-Account hinzufügen",
          email: "E-Mail",
          trialEndsOn: "Trial endet am",
          save: "Speichern",
          cancel: "Abbrechen",
          copy: "E-Mail kopieren",
          copied: "Kopiert",
          trialSuffix: "Trial endet",
        }
      : {
          title: "Email Warm Up",
          status: "Live",
          summary: `${daysLeft ?? 0} days until trial end`,
          accounts: "Accounts",
          instantly: "Open Instantly.ai",
          addAccount: "Add new account",
          modalTitle: "Add warmup account",
          email: "Email",
          trialEndsOn: "Trial ends on",
          save: "Save",
          cancel: "Cancel",
          copy: "Copy email address",
          copied: "Copied",
          trialSuffix: "Trial ends",
        };

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedEmail(value);
      window.setTimeout(() => {
        setCopiedEmail((current) => (current === value ? null : current));
      }, 1800);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/warmup-accounts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          trialEndsOn,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        accounts?: WarmupAccount[];
      };

      if (!response.ok || !payload.ok || !payload.accounts) {
        throw new Error(payload.error ?? "Warmup account could not be saved.");
      }

      setAccounts(payload.accounts);
      setEmail("");
      setTrialEndsOn("2026-04-22");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Warmup account could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="glass-panel rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{labels.title}</p>
            <p className="mt-2 text-sm text-slate-600">{labels.summary}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            {labels.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="https://instantly.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-line bg-surface-strong px-3 py-1.5 text-xs font-medium text-foreground transition hover:opacity-90"
          >
            {labels.instantly}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-line bg-surface-strong px-3 py-1.5 text-xs font-medium text-foreground transition hover:opacity-90"
          >
            {labels.addAccount}
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{labels.accounts}</p>
          <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-1">
            {accounts.map((account) => {
              const accountDaysLeft = calculateWarmupDaysLeft(account.trialEndsOn);
              const trialEndsLabel = formatWarmupTrialEndDate(
                account.trialEndsOn,
                language === "de" ? "de-DE" : "en-US",
              );
              const isExpiringSoon = accountDaysLeft <= 1;

              return (
                <div
                  key={account.id}
                  className={`rounded-[22px] border p-4 ${
                    isExpiringSoon
                      ? "border-rose-300 bg-rose-50/90"
                      : "border-line bg-white/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isExpiringSoon ? "text-rose-800" : "text-slate-950"
                        }`}
                      >
                        {account.email}
                      </p>
                      <p className={`mt-1 text-xs ${isExpiringSoon ? "text-rose-700" : "text-slate-600"}`}>
                        {labels.trialSuffix} {trialEndsLabel} · {accountDaysLeft}{" "}
                        {language === "de" ? "Tage" : "days"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(account.email)}
                      className={`inline-flex size-9 items-center justify-center rounded-full border bg-white transition ${
                        isExpiringSoon
                          ? "border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-800"
                          : "border-line text-slate-500 hover:border-slate-300 hover:text-slate-900"
                      }`}
                      aria-label={labels.copy}
                      title={copiedEmail === account.email ? labels.copied : labels.copy}
                    >
                      <CopyIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-line bg-surface-strong p-6 text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-muted">{labels.title}</p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">{labels.modalTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                }}
                className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-lg text-foreground transition hover:opacity-90"
                aria-label={labels.cancel}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">{labels.email}</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-foreground outline-none transition focus:border-slate-900"
                  placeholder="name@domain.com"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">{labels.trialEndsOn}</span>
                <input
                  required
                  type="date"
                  value={trialEndsOn}
                  onChange={(event) => setTrialEndsOn(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-foreground outline-none transition focus:border-slate-900"
                />
              </label>

              {errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:opacity-90"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "..." : labels.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
