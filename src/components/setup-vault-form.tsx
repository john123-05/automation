"use client";

import { useMemo, useState, useTransition } from "react";
import { t } from "@/lib/copy";
import type { SetupVaultSectionState } from "@/lib/setup-vault";
import type { UiLanguage } from "@/lib/ui-settings-shared";

export function SetupVaultForm({
  sections,
  language = "en",
}: {
  sections: SetupVaultSectionState[];
  language?: UiLanguage;
}) {
  const initialDrafts = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [
          section.id,
          Object.fromEntries(section.fields.map((field) => [field.key, ""])),
        ]),
      ) as Record<string, Record<string, string>>,
    [sections],
  );
  const [drafts, setDrafts] = useState(initialDrafts);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setValue(sectionId: string, key: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        [key]: value,
      },
    }));
  }

  function saveSection(sectionId: string) {
    setMessages((current) => ({ ...current, [sectionId]: "" }));
    setErrors((current) => ({ ...current, [sectionId]: "" }));
    setPendingSectionId(sectionId);

    startTransition(async () => {
      try {
        const values = drafts[sectionId] ?? {};
        const response = await fetch("/api/setup/secrets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sectionId,
            values,
          }),
        });

        const payload = (await response.json()) as { ok: boolean; error?: string; savedKeys?: string[] };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Section could not be saved.");
        }

        setDrafts((current) => ({
          ...current,
          [sectionId]: Object.fromEntries(
            Object.keys(current[sectionId] ?? {}).map((key) => [key, ""]),
          ),
        }));
        setMessages((current) => ({
          ...current,
          [sectionId]:
            language === "de"
              ? `${payload.savedKeys?.length ?? 0} Feld(er) gespeichert. Starte den Dev-Server neu, falls ein Provider noch den alten Stand zeigt.`
              : `Saved ${payload.savedKeys?.length ?? 0} field(s). Restart the dev server if a provider still shows the old state.`,
        }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          [sectionId]:
            error instanceof Error
              ? error.message
              : language === "de"
                ? "Bereich konnte nicht gespeichert werden."
                : "Section could not be saved.",
        }));
      } finally {
        setPendingSectionId(null);
      }
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {sections.map((section) => {
        const isSaving = isPending && pendingSectionId === section.id;

        return (
          <div key={section.id} className="glass-panel rounded-[32px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "setupVault")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-3 text-sm text-slate-700">{section.description}</p>
              </div>
              <button
                type="button"
                onClick={() => saveSection(section.id)}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? (language === "de" ? "Speichern..." : "Saving...") : language === "de" ? "Bereich speichern" : "Save section"}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {section.fields.map((field) => (
                <div key={field.key} className="rounded-[24px] border border-line bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{field.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{field.key}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        field.hasValue
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {field.preview}
                    </span>
                  </div>

                  {field.multiline ? (
                    <textarea
                      value={drafts[section.id]?.[field.key] ?? ""}
                      onChange={(event) => setValue(section.id, field.key, event.target.value)}
                      placeholder={
                        field.placeholder
                          ? `${field.placeholder}\n${
                              language === "de"
                                ? "Leer lassen, um den aktuellen Wert zu behalten."
                                : "Leave blank to keep current value."
                            }`
                          : language === "de"
                            ? "Leer lassen, um den aktuellen Wert zu behalten."
                            : "Leave blank to keep current value."
                      }
                      className="mt-4 min-h-28 w-full rounded-[20px] border border-line bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                    />
                  ) : (
                    <input
                      value={drafts[section.id]?.[field.key] ?? ""}
                      onChange={(event) => setValue(section.id, field.key, event.target.value)}
                      placeholder={
                        field.placeholder
                          ? `${field.placeholder} — ${
                              language === "de"
                                ? "leer lassen, um den aktuellen Wert zu behalten"
                                : "leave blank to keep current value"
                            }`
                          : language === "de"
                            ? "Leer lassen, um den aktuellen Wert zu behalten"
                            : "Leave blank to keep current value"
                      }
                      className="mt-4 w-full rounded-[20px] border border-line bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                    />
                  )}
                </div>
              ))}
            </div>

            {messages[section.id] ? (
              <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {messages[section.id]}
              </div>
            ) : null}
            {errors[section.id] ? (
              <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errors[section.id]}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
