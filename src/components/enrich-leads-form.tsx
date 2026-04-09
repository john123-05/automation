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
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "scope")}</span>
          <select
            name="scope"
            defaultValue={defaultScope}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          >
            <option value="run">{t(language, "onlyOneLeadSearchRun")}</option>
            <option value="all-pending">{t(language, "allPendingLeads")}</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "leadSearchRun")}</span>
          <select
            name="sourceRunId"
            defaultValue={searchRunOptions[0]?.id ?? ""}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "batchSize")}</span>
          <input
            name="batchSize"
            type="number"
            min={1}
            max={50}
            defaultValue={10}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            required
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-slate-700">
          <input
            name="includePreviouslyFailed"
            type="checkbox"
            className="size-4 rounded border border-line"
          />
          {t(language, "retryFailedLeads")}
        </label>
      </div>

      <div className="rounded-[24px] border border-line bg-white/70 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-700">
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

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton
          idleLabel={t(language, "runContactEnrichment")}
          pendingLabel={t(language, "runningGeminiResearch")}
        />
        <FormPendingIndicator label={`Working through ${defaultRunLabel}...`} />
        {state.message ? (
          <p
            className={`text-sm ${
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
