"use client";

import { useActionState, useState } from "react";
import { searchLeadsAction } from "@/app/actions";
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

export function SearchLeadsForm({ language = "en" }: { language?: UiLanguage }) {
  const [state, formAction] = useActionState(searchLeadsAction, initialState);
  const [searchMode, setSearchMode] = useState<"capped" | "exhaustive">("capped");
  const [maxLeads, setMaxLeads] = useState(30);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "niche")}</span>
          <input
            name="niche"
            defaultValue="restaurants"
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            placeholder="restaurants, dentists, gyms"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "location")}</span>
          <input
            name="location"
            defaultValue="London, UK"
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            placeholder="London, UK"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{t(language, "radiusMeters")}</span>
          <input
            name="radiusMeters"
            type="number"
            min={100}
            max={50000}
            defaultValue={1500}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {searchMode === "exhaustive" ? t(language, "safetyCap") : t(language, "maxLeads")}
          </span>
          <input
            name="maxLeads"
            type="number"
            min={1}
            max={500}
            value={maxLeads}
            onChange={(event) => {
              setMaxLeads(Number(event.target.value));
            }}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            required
          />
        </label>
      </div>

      <div className="rounded-[24px] border border-line bg-white/70 p-4">
        <input name="searchMode" type="hidden" value={searchMode} />
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={searchMode === "exhaustive"}
            onChange={(event) => {
              const nextMode = event.target.checked ? "exhaustive" : "capped";
              setSearchMode(nextMode);

              if (nextMode === "exhaustive" && maxLeads === 30) {
                setMaxLeads(120);
              }

              if (nextMode === "capped" && maxLeads === 120) {
                setMaxLeads(30);
              }
            }}
            className="size-4 rounded border border-line"
          />
          {t(language, "searchUntilNoPages")}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton
          idleLabel={
            searchMode === "exhaustive"
              ? t(language, "runExhaustiveSearch")
              : t(language, "runLeadSearch")
          }
          pendingLabel={t(language, "searchingGooglePlaces")}
        />
        <FormPendingIndicator label={t(language, "searchingGooglePlacesLong")} />
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

      <LiveJobProgress kind="search" />
    </form>
  );
}
