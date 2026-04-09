"use client";

import { addManualContactAction, importContactsCsvAction } from "@/app/actions";
import { QuickAddModal } from "@/components/quick-add-modal";
import { t } from "@/lib/copy";
import type { Lead } from "@/lib/sales-machine/types";
import type { UiLanguage } from "@/lib/ui-settings-shared";

type QuickAddContactModalProps = {
  leads: Lead[];
  returnPath: string;
  triggerClassName?: string;
  language?: UiLanguage;
};

export function QuickAddContactModal({
  leads,
  returnPath,
  triggerClassName,
  language = "en",
}: QuickAddContactModalProps) {
  return (
    <QuickAddModal
      title={t(language, "addContacts")}
      description={t(language, "addContactsDescription")}
      triggerLabel={t(language, "addContact")}
      triggerClassName={triggerClassName}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <form action={addManualContactAction} className="rounded-[24px] border border-line bg-white/75 p-4">
          <input type="hidden" name="returnPath" value={returnPath} />
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{t(language, "manualContact")}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "company")}</span>
              <select
                name="leadId"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                required
              >
                <option value="">{t(language, "selectCompany")}</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.companyName} · {lead.locationLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "name")}</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "title")}</span>
              <input
                name="title"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                name="email"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "linkedin")}</span>
              <input
                name="linkedin"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "instagram")}</span>
              <input
                name="instagram"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "twitterX")}</span>
              <input
                name="twitter"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "facebook")}</span>
              <input
                name="facebook"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "confidence")}</span>
              <select
                name="confidence"
                defaultValue="medium"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
              >
                <option value="high">{t(language, "high")}</option>
                <option value="medium">{t(language, "medium")}</option>
                <option value="low">{t(language, "low")}</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {t(language, "saveContact")}
            </button>
          </div>
        </form>

        <form action={importContactsCsvAction} className="rounded-[24px] border border-line bg-white/75 p-4">
          <input type="hidden" name="returnPath" value={returnPath} />
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{t(language, "csvImport")}</p>

          <div className="mt-4 rounded-[20px] border border-dashed border-line bg-white px-4 py-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t(language, "csvFile")}</span>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-slate-800"
                required
              />
            </label>
          </div>

          <div className="mt-4 rounded-[20px] border border-line bg-white px-4 py-4 text-xs text-slate-600">
            <p className="font-medium text-slate-800">{t(language, "supportedColumns")}</p>
            <p className="mt-2">
              <code>lead_id</code>, <code>company_name</code> or <code>company</code>, <code>name</code>,
              <code>title</code>, <code>email</code>, <code>linkedin</code>, <code>instagram</code>,
              <code>twitter</code>, <code>facebook</code>, <code>confidence</code>
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {t(language, "importContacts")}
            </button>
          </div>
        </form>
      </div>
    </QuickAddModal>
  );
}
