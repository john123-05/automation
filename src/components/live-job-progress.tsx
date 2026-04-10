"use client";

import { useEffect, useState } from "react";

type ProgressPayload = {
  search: {
    runId: string;
    current: number;
    total: number;
    pagesFetched: number;
    percent: number;
    detail: string;
  } | null;
  enrichment: {
    runId: string;
    current: number;
    total: number;
    enriched: number;
    missing: number;
    failed: number;
    percent: number;
    detail: string;
  } | null;
};

export function LiveJobProgress({
  kind,
}: {
  kind: "search" | "enrichment";
}) {
  const [payload, setPayload] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      let hasActiveJob = false;

      try {
        const response = await fetch("/api/progress", {
          method: "GET",
          cache: "no-store",
        });

        if (response.ok) {
          const next = (await response.json()) as ProgressPayload;

          if (active) {
            setPayload(next);
            hasActiveJob = kind === "search" ? !!next.search : !!next.enrichment;
          }
        }
      } catch {
        // Ignore transient polling issues.
      }

      if (active) {
        timeoutId = setTimeout(load, hasActiveJob ? 2000 : 10000);
      }
    }

    void load();

    return () => {
      active = false;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [kind]);

  const job = kind === "search" ? payload?.search : payload?.enrichment;

  if (!job) {
    return null;
  }

  return (
    <div className="w-full max-w-xl rounded-[24px] border border-line bg-white/80 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">
          {kind === "search"
            ? `Lead search running: ${job.current} / ${job.total}`
            : `Enrichment running: ${job.current} / ${job.total}`}
        </p>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
          {job.percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-950 transition-[width] duration-500"
          style={{ width: `${Math.max(job.percent, 6)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">{job.detail}</p>
    </div>
  );
}
