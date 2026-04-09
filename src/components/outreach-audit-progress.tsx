"use client";

import { useEffect, useState } from "react";

type AuditProgressPayload = {
  audit: {
    jobId: string;
    runId: string;
    current: number;
    total: number;
    findingsCreated: number;
    failed: number;
    currentLeadName: string | null;
    percent: number;
    detail: string;
  } | null;
};

export function OutreachAuditProgress() {
  const [payload, setPayload] = useState<AuditProgressPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/audits/progress", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const next = (await response.json()) as AuditProgressPayload;

        if (active) {
          setPayload(next);
        }
      } catch {
        // Ignore transient polling issues.
      }
    }

    void load();
    const interval = window.setInterval(load, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!payload?.audit) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-line bg-white/80 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">
          Audit running: {payload.audit.current} / {payload.audit.total}
        </p>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
          {payload.audit.percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-950 transition-[width] duration-500"
          style={{ width: `${Math.max(payload.audit.percent, 6)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">{payload.audit.detail}</p>
    </div>
  );
}
