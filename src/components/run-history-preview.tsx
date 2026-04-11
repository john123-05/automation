"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { t } from "@/lib/copy";
import type { WorkflowRun } from "@/lib/sales-machine/types";
import type { UiLanguage } from "@/lib/ui-settings-shared";

export function RunHistoryPreview({
  runs,
  children,
  language,
}: {
  runs: WorkflowRun[];
  children: ReactNode;
  language: UiLanguage;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="glass-panel rounded-[20px] p-3 sm:rounded-[24px] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted sm:text-sm sm:tracking-[0.18em]">
              {t(language, "runHistory")}
            </p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              {runs.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-line bg-surface-strong px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
          >
            {t(language, "expand")}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[32px] border border-line bg-surface-strong text-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "runHistory")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">{t(language, "allRuns")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-lg text-foreground transition hover:opacity-90"
                aria-label={t(language, "closeRunHistory")}
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
