"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function CampaignScheduleForm({
  campaignId,
  timezone,
  sendWindowStart,
  sendWindowEnd,
  allowedWeekdays,
  stopOnReply,
  waitHoursAfterFinalStep,
}: {
  campaignId: string;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  allowedWeekdays: number[];
  stopOnReply: boolean;
  waitHoursAfterFinalStep: number;
}) {
  const router = useRouter();
  const [currentTimezone, setCurrentTimezone] = useState(timezone);
  const [currentStart, setCurrentStart] = useState(sendWindowStart);
  const [currentEnd, setCurrentEnd] = useState(sendWindowEnd);
  const [currentWeekdays, setCurrentWeekdays] = useState(allowedWeekdays);
  const [currentStopOnReply, setCurrentStopOnReply] = useState(stopOnReply);
  const [currentWaitHours, setCurrentWaitHours] = useState(waitHoursAfterFinalStep);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleWeekday(value: number) {
    setCurrentWeekdays((previous) =>
      previous.includes(value)
        ? previous.filter((candidate) => candidate !== value)
        : [...previous, value].sort((a, b) => a - b),
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Timezone</span>
          <input
            type="text"
            value={currentTimezone}
            onChange={(event) => setCurrentTimezone(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Window start</span>
          <input
            type="time"
            value={currentStart}
            onChange={(event) => setCurrentStart(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Window end</span>
          <input
            type="time"
            value={currentEnd}
            onChange={(event) => setCurrentEnd(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Allowed weekdays</p>
        <div className="flex flex-wrap gap-2">
          {weekdayOptions.map((option) => {
            const active = currentWeekdays.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleWeekday(option.value)}
                className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-slate-950 text-white"
                    : "border border-line bg-white text-slate-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={currentStopOnReply}
            onChange={(event) => setCurrentStopOnReply(event.target.checked)}
            className="size-4 rounded border border-line"
          />
          Stop all future steps after a reply
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Escalation wait (hours)
          </span>
          <input
            type="number"
            min={1}
            max={336}
            value={currentWaitHours}
            onChange={(event) => setCurrentWaitHours(Number.parseInt(event.target.value || "72", 10))}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const response = await fetch(`/api/campaigns/${campaignId}/schedule`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  timezone: currentTimezone,
                  sendWindowStart: currentStart,
                  sendWindowEnd: currentEnd,
                  allowedWeekdays: currentWeekdays,
                  stopOnReply: currentStopOnReply,
                  waitHoursAfterFinalStep: currentWaitHours,
                }),
              });
              const payload = (await response.json()) as { ok: boolean; error?: string };

              if (!response.ok || !payload.ok) {
                setMessage(payload.error ?? "Schedule update failed.");
                return;
              }

              router.refresh();
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save schedule"}
        </button>
        {message ? <p className="text-xs text-rose-700">{message}</p> : null}
      </div>
    </div>
  );
}
