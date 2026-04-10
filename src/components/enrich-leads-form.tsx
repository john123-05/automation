"use client";

import { useActionState, useMemo } from "react";
import { enrichLeadsAction } from "@/app/actions";
import { FormPendingIndicator } from "@/components/form-pending-indicator";
import { LiveJobProgress } from "@/components/live-job-progress";
import { SubmitButton } from "@/components/submit-button";
import { t } from "@/lib/copy";
import type { FormState } from "@/lib/sales-machine/types";
import type { UiLanguage } from "@/lib/ui-settings-shared";

const initialState: FormState = {
  status: "idle",
  message: "",
};

type SearchRunOption = {
  id: string;
  label: string;
};

export function EnrichLeadsForm({
  searchRunOptions,
  language = "en",
}: {
  searchRunOptions: SearchRunOption[];
  language?: UiLanguage;
}) {
  const [state, formAction] = useActionState(enrichLeadsAction, initialState);
  const defaultScope = searchRunOptions.length ? "run" : "all-pending";
  const defaultRunLabel = useMemo(
    () => searchRunOptions[0]?.label ?? t(language, "leadSearchRun").toLowerCase(),
    [language, searchRunOptions],
  );

  return (
    <form action={formAction} className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-medium text-slate-700 sm:text-sm">{t(language, "scope")}</span>
          <select
            name="scope"
            defaultValue={defaultScope}
            className="w-full rounded-[18px] border border-line bg-white/80 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:rounded-2xl sm:px-4 sm:py-3"
          >
            <option value="run">{t(language, "onlyOneLeadSearchRun")}</option>
            <option value="all-pending">{t(language, "allPendingLeads")}</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-medium text-slate-700 sm:text-sm">{t(language, "leadSearchRun")}</span>
          <select
            name="sourceRunId"
            defaultValue={searchRunOptions[0]?.id ?? ""}
            className="w-full rounded-[18px] border border-line bg-white/80 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:rounded-2xl sm:px-4 sm:py-3"
            disabled={searchRunOptions.length === 0}
          >
            {searchRunOptions.length ? (
              searchRunOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            ) : (
              <option value="">{t(language, "noLeadSearchRunYet")}</option>
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-2">
          <span className="text-xs font-medium text-slate-700 sm:text-sm">{t(language, "batchSize")}</span>
          <input
            name="batchSize"
            type="number"
            min={1}
            max={50}
            defaultValue={10}
            className="w-full rounded-[18px] border border-line bg-white/80 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:rounded-2xl sm:px-4 sm:py-3"
            required
          />
        </label>

        <label className="flex items-center gap-3 rounded-[18px] border border-line bg-white/70 px-3 py-2.5 text-xs text-slate-700 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          <input
            name="includePreviouslyFailed"
            type="checkbox"
            className="size-4 rounded border border-line"
          />
          {t(language, "retryFailedLeads")}
        </label>
      </div>

      <div className="rounded-[18px] border border-line bg-white/70 p-3 sm:rounded-[24px] sm:p-4">
        <label className="flex items-start gap-3 text-xs text-slate-700 sm:text-sm">
          <input
            name="allowOpenAiSecondPass"
            type="checkbox"
            className="mt-0.5 size-4 rounded border border-line"
          />
          <span>
            <span className="block font-medium text-slate-900">{t(language, "useOpenAiFallback")}</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-1 sm:gap-3 sm:pt-2">
        <SubmitButton
          idleLabel={t(language, "runContactEnrichment")}
          pendingLabel={t(language, "runningGeminiResearch")}
        />
        <FormPendingIndicator label={`Working through ${defaultRunLabel}...`} />
        {state.message ? (
          <p
            className={`text-xs sm:text-sm ${
              state.status === "error" ? "text-danger" : "text-slate-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>

      <LiveJobProgress kind="enrichment" />
    </form>
  );
}
