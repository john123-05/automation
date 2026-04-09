"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ServiceKey } from "@/lib/sales-machine/types";

type ScopeOption = {
  id: string;
  label: string;
};

type MailboxOption = {
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

export function CampaignCreateForm({
  runOptions,
  sheetOptions,
  mailboxOptions,
}: {
  runOptions: ScopeOption[];
  sheetOptions: ScopeOption[];
  mailboxOptions: MailboxOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"run" | "sheet" | "all">(
    runOptions.length ? "run" : sheetOptions.length ? "sheet" : "all",
  );
  const [serviceKey, setServiceKey] = useState<ServiceKey>("seo");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim() || null,
          serviceKey,
          sourceScope: scope,
          sourceRunId:
            scope === "run" ? String(formData.get("sourceRunId") || "").trim() || null : null,
          sheetKey:
            scope === "sheet" ? String(formData.get("sheetKey") || "").trim() || null : null,
          mailboxId: String(formData.get("mailboxId") || "").trim() || null,
          timezone,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        campaignId?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.campaignId) {
        setMessage(payload.error ?? "Campaign creation failed.");
        return;
      }

      router.push(`/outreach/campaign/${payload.campaignId}/overview`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Campaign name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional. We can auto-name from service + sheet."
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service lens</span>
          <select
            value={serviceKey}
            onChange={(event) => setServiceKey(event.target.value as ServiceKey)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          >
            {serviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Source scope</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as "run" | "sheet" | "all")}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          >
            <option value="run">One lead-search run</option>
            <option value="sheet">One workspace sheet</option>
            <option value="all">All leads</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Timezone</span>
          <input
            type="text"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Mailbox</span>
          <select
            name="mailboxId"
            defaultValue={mailboxOptions[0]?.id ?? ""}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          >
            <option value="">Assign later</option>
            {mailboxOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scope === "run" ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Lead-search run</span>
          <select
            name="sourceRunId"
            defaultValue={runOptions[0]?.id ?? ""}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
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
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
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

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creating..." : "Create campaign"}
        </button>
        {message ? <p className="text-sm text-rose-700">{message}</p> : null}
      </div>
    </form>
  );
}
