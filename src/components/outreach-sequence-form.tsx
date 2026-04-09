"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ServiceKey } from "@/lib/sales-machine/types";

type ScopeOption = {
  id: string;
  label: string;
};

const serviceOptions: Array<{ value: ServiceKey; label: string }> = [
  { value: "seo", label: "SEO" },
  { value: "webdesign", label: "Web Design" },
  { value: "copywriting", label: "Copywriting" },
  { value: "ai_automation", label: "AI Automation" },
  { value: "marketing", label: "Marketing" },
  { value: "lead_capture", label: "Lead Capture" },
];

type MailboxOption = {
  id: string;
  label: string;
};

export function OutreachSequenceForm({
  runOptions,
  sheetOptions,
  mailboxOptions,
}: {
  runOptions: ScopeOption[];
  sheetOptions: ScopeOption[];
  mailboxOptions: MailboxOption[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"run" | "sheet" | "all">(
    runOptions.length ? "run" : sheetOptions.length ? "sheet" : "all",
  );
  const [serviceKey, setServiceKey] = useState<ServiceKey>("webdesign");
  const [onlyUnsequenced, setOnlyUnsequenced] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage("");
    setStatus("idle");

    startTransition(async () => {
      const response = await fetch("/api/sequences/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          serviceKey,
          scope,
          sourceRunId:
            scope === "run" ? String(formData.get("sourceRunId") || "").trim() || null : null,
          sheetKey:
            scope === "sheet" ? String(formData.get("sheetKey") || "").trim() || null : null,
          mailboxId: String(formData.get("mailboxId") || "").trim() || null,
          onlyUnsequenced,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        generated?: number;
        updated?: number;
      };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Sequence generation failed.");
        return;
      }

      setStatus("success");
      setMessage(
        `Sequence generation finished. ${payload.generated ?? 0} new draft(s), ${payload.updated ?? 0} updated.`,
      );
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service lens</span>
          <select
            value={serviceKey}
            onChange={(event) => setServiceKey(event.target.value as ServiceKey)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          >
            {serviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Scope</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as "run" | "sheet" | "all")}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          >
            <option value="run">One lead-search run</option>
            <option value="sheet">One workspace sheet</option>
            <option value="all">All audited leads</option>
          </select>
        </label>
      </div>

      {scope === "run" ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Lead-search run</span>
          <select
            name="sourceRunId"
            defaultValue={runOptions[0]?.id ?? ""}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          >
            {runOptions.length ? (
              runOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            ) : (
              <option value="">No lead-search runs yet</option>
            )}
          </select>
        </label>
      ) : null}

      {scope === "sheet" ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Workspace sheet</span>
          <select
            name="sheetKey"
            defaultValue={sheetOptions[0]?.id ?? ""}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          >
            {sheetOptions.length ? (
              sheetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            ) : (
              <option value="">No sheets yet</option>
            )}
          </select>
        </label>
      ) : null}

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Mailbox for sending later</span>
        <select
          name="mailboxId"
          defaultValue={mailboxOptions[0]?.id ?? ""}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
        >
          <option value="">No mailbox assigned yet</option>
          {mailboxOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={onlyUnsequenced}
          onChange={(event) => setOnlyUnsequenced(event.target.checked)}
          className="size-4 rounded border border-line"
        />
        Only generate drafts for leads that do not already have a sequence
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Generating..." : "Generate 4-Step Sequence"}
        </button>
        {message ? (
          <p className={`text-sm ${status === "error" ? "text-danger" : "text-slate-700"}`}>
            {message}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white/75 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              Rendering the written-first cadence from saved variables...
            </p>
            <span className="inline-flex size-2 animate-pulse rounded-full bg-slate-900" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-slate-900" />
          </div>
        </div>
      ) : null}
    </form>
  );
}
