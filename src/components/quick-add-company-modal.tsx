"use client";

import { addCompanyAction } from "@/app/actions";
import { QuickAddModal } from "@/components/quick-add-modal";
import { t } from "@/lib/copy";
import type { UiLanguage } from "@/lib/ui-settings-shared";

type QuickAddCompanyModalProps = {
  returnPath: string;
  triggerClassName?: string;
  language?: UiLanguage;
};

export function QuickAddCompanyModal({
  returnPath,
  triggerClassName,
  language = "en",
}: QuickAddCompanyModalProps) {
  return (
    <QuickAddModal
      title={t(language, "addCompanyTitle")}
      description={t(language, "addCompanyDescription")}
      triggerLabel={t(language, "addCompany")}
      triggerClassName={triggerClassName}
    >
      <form action={addCompanyAction} className="space-y-5">
        <input type="hidden" name="returnPath" value={returnPath} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "companyName")}</span>
            <input
              name="companyName"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "niche")}</span>
            <input
              name="niche"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "location")}</span>
            <input
              name="locationLabel"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              required
            />
          </label>
          <label className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-medium text-slate-700">{t(language, "address")}</span>
            <input
              name="address"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "website")}</span>
            <input
              type="url"
              name="websiteUri"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "nationalPhone")}</span>
            <input
              name="nationalPhoneNumber"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t(language, "internationalPhone")}</span>
            <input
              name="internationalPhoneNumber"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
            />
          </label>
        </div>

        <div className="rounded-[22px] border border-line bg-white px-4 py-4">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{t(language, "optionalFirstContact")}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "name")}</span>
              <input
                name="contactName"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "title")}</span>
              <input
                name="contactTitle"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                name="contactEmail"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "linkedin")}</span>
              <input
                name="contactLinkedin"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "confidence")}</span>
              <select
                name="contactConfidence"
                defaultValue="medium"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              >
                <option value="high">{t(language, "high")}</option>
                <option value="medium">{t(language, "medium")}</option>
                <option value="low">{t(language, "low")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {t(language, "manualCompaniesHint")}
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {t(language, "saveCompany")}
          </button>
        </div>
      </form>
    </QuickAddModal>
  );
}
