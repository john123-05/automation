"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CampaignStepTemplateEditor({
  campaignId,
  stepNumber,
  initialSubjectTemplate,
  initialBodyTemplate,
  initialDayOffset,
  initialEnabled,
}: {
  campaignId: string;
  stepNumber: 1 | 2 | 3 | 4;
  initialSubjectTemplate: string;
  initialBodyTemplate: string;
  initialDayOffset: number;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [subjectTemplate, setSubjectTemplate] = useState(initialSubjectTemplate);
  const [bodyTemplate, setBodyTemplate] = useState(initialBodyTemplate);
  const [dayOffset, setDayOffset] = useState(initialDayOffset);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Day offset</span>
        <input
          type="number"
          min={0}
          max={30}
          value={dayOffset}
          onChange={(event) => setDayOffset(Number.parseInt(event.target.value || "0", 10))}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Subject template</span>
        <input
          type="text"
          value={subjectTemplate}
          onChange={(event) => setSubjectTemplate(event.target.value)}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Body template</span>
        <textarea
          value={bodyTemplate}
          onChange={(event) => setBodyTemplate(event.target.value)}
          rows={14}
          className="w-full rounded-[22px] border border-line bg-white/80 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-900"
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-4 rounded border border-line"
        />
        Step enabled
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const response = await fetch(`/api/campaigns/${campaignId}/steps/update`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  stepNumber,
                  subjectTemplate,
                  bodyTemplate,
                  dayOffset,
                  enabled,
                }),
              });
              const payload = (await response.json()) as { ok: boolean; error?: string };

              if (!response.ok || !payload.ok) {
                setMessage(payload.error ?? "Step update failed.");
                return;
              }

              router.refresh();
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : `Save step ${stepNumber}`}
        </button>
        {message ? <p className="text-xs text-rose-700">{message}</p> : null}
      </div>
    </div>
  );
}
