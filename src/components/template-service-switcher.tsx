"use client";

import { useMemo, useState } from "react";
import { SequenceTemplateEditor } from "@/components/sequence-template-editor";

type ServiceProfileSummary = {
  id: string;
  serviceKey: string;
  label: string;
  shortDescription: string;
};

type SequenceTemplateSummary = {
  id: string;
  serviceKey: string;
  stepNumber: number;
  dayOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
};

export function TemplateServiceSwitcher({
  serviceProfiles,
  templates,
  initialServiceKey,
}: {
  serviceProfiles: ServiceProfileSummary[];
  templates: SequenceTemplateSummary[];
  initialServiceKey: string | null;
}) {
  const [selectedServiceKey, setSelectedServiceKey] = useState(
    initialServiceKey ?? serviceProfiles[0]?.serviceKey ?? null,
  );

  const selectedProfile =
    serviceProfiles.find((profile) => profile.serviceKey === selectedServiceKey) ?? serviceProfiles[0] ?? null;

  const selectedTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.serviceKey === selectedProfile?.serviceKey)
        .sort((a, b) => a.stepNumber - b.stepNumber),
    [selectedProfile?.serviceKey, templates],
  );

  return (
    <>
      <div className="border-b border-line pb-4">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Template library</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-2xl font-semibold text-slate-950">Global step defaults by service</h2>
          <div className="-mx-1 overflow-x-auto pb-1 xl:max-w-[58vw]">
            <div className="flex min-w-max gap-2 px-1">
              {serviceProfiles.map((profile) => {
                const active = profile.serviceKey === selectedProfile?.serviceKey;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedServiceKey(profile.serviceKey)}
                    className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-line bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {profile.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedProfile ? (
        <section className="mt-6 rounded-[28px] border border-line bg-white/80 p-5">
          <div className="border-b border-line pb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{selectedProfile.label}</p>
            <p className="mt-2 text-sm text-slate-600">{selectedProfile.shortDescription}</p>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {selectedTemplates.map((template) => (
              <SequenceTemplateEditor
                key={template.id}
                id={template.id}
                stepNumber={template.stepNumber}
                dayOffset={template.dayOffset}
                subjectTemplate={template.subjectTemplate}
                bodyTemplate={template.bodyTemplate}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-6 rounded-[28px] border border-dashed border-line bg-white/70 px-5 py-16 text-center text-sm text-slate-600">
          No service templates are available yet.
        </div>
      )}
    </>
  );
}
