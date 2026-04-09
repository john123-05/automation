import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiActionButton } from "@/components/api-action-button";
import { ApproveSequenceButton } from "@/components/approve-sequence-button";
import { CampaignStepTemplateEditor } from "@/components/campaign-step-template-editor";
import { CampaignTabs } from "@/components/campaign-tabs";
import { OutreachShell } from "@/components/outreach-shell";
import { SequenceStepEditor } from "@/components/sequence-step-editor";
import { requireAppAccess } from "@/lib/app-auth";
import {
  formatServiceLabel,
  getCampaignWorkspaceData,
  getOutreachStateClasses,
} from "@/lib/sales-machine/outreach-ui";

export const dynamic = "force-dynamic";

type CampaignSequencesPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function parseStep(value: string | null) {
  const candidate = Number.parseInt(value ?? "1", 10);
  return candidate >= 1 && candidate <= 4 ? (candidate as 1 | 2 | 3 | 4) : 1;
}

export default async function CampaignSequencesPage({
  params,
  searchParams,
}: CampaignSequencesPageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}/sequences`);
  const query = (searchParams ? await searchParams : undefined) ?? {};
  const data = await getCampaignWorkspaceData(id);

  if (!data) {
    notFound();
  }

  const selectedStepNumber = parseStep(readSearchParam(query.step));
  const previewLeadId = readSearchParam(query.leadId);
  const selectedStep =
    data.steps.find((step) => step.stepNumber === selectedStepNumber) ?? data.steps[0] ?? null;
  const previewRecord =
    (previewLeadId ? data.leadRecords.find((record) => record.lead?.id === previewLeadId) : null) ??
    data.leadRecords.find((record) => record.sequence) ??
    data.leadRecords[0] ??
    null;
  const previewSequenceStep = previewRecord?.sequence?.steps.find(
    (step) => step.stepNumber === selectedStepNumber,
  );

  return (
    <OutreachShell
      activeNav="campaigns"
      title={data.campaign.name}
      subtitle={formatServiceLabel(data.campaign.serviceKey)}
      stats={[
        { label: "Steps", value: data.steps.length.toString() },
        { label: "Leads with drafts", value: data.sequences.length.toString() },
        { label: "Approved", value: data.metrics.approvedCount.toString() },
        { label: "Scheduled", value: data.metrics.scheduledCount.toString() },
        { label: "Sent", value: data.metrics.sentCount.toString() },
        { label: "Replies", value: data.metrics.repliedCount.toString() },
      ]}
    >
      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">
              Campaign-level step templates live here. Lead-specific overrides stay in the Leads tab.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ApiActionButton endpoint={`/api/campaigns/${data.campaign.id}/approve`} label="Approve campaign" />
            <ApiActionButton endpoint={`/api/campaigns/${data.campaign.id}/regenerate`} label="Regenerate drafts" />
          </div>
        </div>

        <div className="mt-6">
          <CampaignTabs campaignId={data.campaign.id} active="sequences" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_minmax(320px,0.78fr)]">
          <section className="rounded-[28px] border border-line bg-white/84 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaign steps</p>
            <div className="mt-4 space-y-3">
              {data.steps.map((step) => {
                const active = step.stepNumber === selectedStep?.stepNumber;
                return (
                  <Link
                    key={step.id}
                    href={`/outreach/campaign/${data.campaign.id}/sequences?step=${step.stepNumber}${
                      previewRecord?.lead ? `&leadId=${encodeURIComponent(previewRecord.lead.id)}` : ""
                    }`}
                    className={`block rounded-[24px] border px-4 py-4 transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-line bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className={`text-sm font-medium ${active ? "text-white" : "text-slate-950"}`}>
                      Day {step.dayOffset + 1} · Step {step.stepNumber}
                    </p>
                    <p className={`mt-2 text-sm ${active ? "text-white/80" : "text-slate-600"}`}>
                      {step.subjectTemplate}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white/84 p-5">
            {selectedStep ? (
              <>
                <div className="border-b border-line pb-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step editor</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    Day {selectedStep.dayOffset + 1} · Step {selectedStep.stepNumber}
                  </h2>
                </div>

                <div className="mt-5">
                  <CampaignStepTemplateEditor
                    campaignId={data.campaign.id}
                    stepNumber={selectedStep.stepNumber}
                    initialSubjectTemplate={selectedStep.subjectTemplate}
                    initialBodyTemplate={selectedStep.bodyTemplate}
                    initialDayOffset={selectedStep.dayOffset}
                    initialEnabled={selectedStep.enabled}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-line px-5 py-16 text-center text-sm text-slate-600">
                No campaign steps are configured yet.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-line bg-white/84 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Rendered preview</p>
            <div className="mt-4 rounded-[22px] border border-line bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {previewRecord?.lead?.companyName ?? "No lead preview available"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {previewRecord?.finding?.summary ?? "Generate drafts to see a rendered example."}
                  </p>
                </div>
                {previewRecord?.sequence ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getOutreachStateClasses(
                      previewRecord.sequence.state,
                    )}`}
                  >
                    {previewRecord.sequence.state}
                  </span>
                ) : null}
              </div>

              {previewRecord?.sequence && previewSequenceStep ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {previewSequenceStep.sendState}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {previewSequenceStep.approvalState}
                    </span>
                  </div>

                  <SequenceStepEditor
                    sequenceId={previewRecord.sequence.id}
                    stepNumber={selectedStepNumber}
                    initialSubject={previewSequenceStep.subject}
                    initialBody={previewSequenceStep.body}
                    isSent={previewSequenceStep.sendState === "sent"}
                  />

                  <div className="flex flex-wrap gap-2">
                    <ApproveSequenceButton sequenceId={previewRecord.sequence.id} />
                    <Link
                      href={`/outreach/campaign/${data.campaign.id}/leads?leadId=${encodeURIComponent(
                        previewRecord.lead?.id ?? "",
                      )}&step=${selectedStepNumber}`}
                      className="rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Open full lead panel
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Generate drafts to restore the rendered preview and editing panel here.
                </p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Affected leads · {data.sequences.length}
              </p>
              <div className="mt-3 space-y-3">
                {data.leadRecords.filter((record) => record.sequence).slice(0, 8).map((record) => (
                  <Link
                    key={record.campaignLead.id}
                    href={`/outreach/campaign/${data.campaign.id}/sequences?step=${selectedStepNumber}&leadId=${encodeURIComponent(
                      record.campaignLead.leadId,
                    )}`}
                    className={`block rounded-[20px] border px-4 py-3 transition ${
                      record.lead?.id === previewRecord?.lead?.id
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-line bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className={`text-sm font-medium ${record.lead?.id === previewRecord?.lead?.id ? "text-white" : "text-slate-950"}`}>
                      {record.lead?.companyName ?? "Unknown lead"}
                    </p>
                    <p className={`mt-1 text-sm ${record.lead?.id === previewRecord?.lead?.id ? "text-white/80" : "text-slate-600"}`}>
                      {record.finding?.summary ?? "No finding summary yet."}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </OutreachShell>
  );
}
