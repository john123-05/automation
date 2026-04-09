import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveSequenceButton } from "@/components/approve-sequence-button";
import { CampaignTabs } from "@/components/campaign-tabs";
import { OutreachShell } from "@/components/outreach-shell";
import { OutreachStateSelector } from "@/components/outreach-state-selector";
import { SendSequenceStepButton } from "@/components/send-sequence-step-button";
import { SequenceStepEditor } from "@/components/sequence-step-editor";
import { SuppressRecipientButton } from "@/components/suppress-recipient-button";
import { requireAppAccess } from "@/lib/app-auth";
import {
  formatServiceLabel,
  formatStateLabel,
  getCampaignStatusClasses,
  getCampaignWorkspaceData,
  getOutreachStateClasses,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type CampaignLeadsPageProps = {
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

export default async function CampaignLeadsPage({
  params,
  searchParams,
}: CampaignLeadsPageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}/leads`);
  const query = (searchParams ? await searchParams : undefined) ?? {};
  const data = await getCampaignWorkspaceData(id);

  if (!data) {
    notFound();
  }

  const leadId = readSearchParam(query.leadId);
  const selectedStep = parseStep(readSearchParam(query.step));
  const selectedRecord =
    (leadId ? data.leadRecords.find((record) => record.lead?.id === leadId) : null) ??
    data.leadRecords[0] ??
    null;
  const selectedSequenceStep = selectedRecord?.sequence?.steps.find(
    (step) => step.stepNumber === selectedStep,
  );
  const suppressionEmail = selectedRecord?.contact?.email ?? selectedRecord?.thread?.contactEmail ?? null;

  return (
    <OutreachShell
      activeNav="campaigns"
      title={data.campaign.name}
      subtitle={formatServiceLabel(data.campaign.serviceKey)}
      stats={[
        { label: "Leads", value: data.metrics.leadCount.toString() },
        { label: "Drafted", value: data.metrics.draftedCount.toString() },
        { label: "Approved", value: data.metrics.approvedCount.toString() },
        { label: "Scheduled", value: data.metrics.scheduledCount.toString() },
        { label: "Sent", value: data.metrics.sentCount.toString() },
        { label: "Replies / Booked", value: `${data.metrics.repliedCount} / ${data.metrics.bookedCount}` },
      ]}
    >
      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getCampaignStatusClasses(
                data.campaign.status,
              )}`}
            >
              {data.campaign.status}
            </span>
            <p className="text-sm text-slate-600">
              Lead-level overrides, proof, and outreach state live here.
            </p>
          </div>
          <Link
            href={`/outreach/campaign/${data.campaign.id}/sequences`}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open campaign sequence builder
          </Link>
        </div>

        <div className="mt-6">
          <CampaignTabs campaignId={data.campaign.id} active="leads" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)]">
          <div className="rounded-[28px] border border-line bg-white/84 p-5">
            <div className="border-b border-line pb-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaign leads</p>
            </div>

            <div className="mt-4 space-y-3">
              {data.leadRecords.length ? (
                data.leadRecords.map((record) => {
                  const isActive = record.lead?.id === selectedRecord?.lead?.id;
                  const status = record.outreachState?.state ?? record.campaignLead.status;

                  return (
                    <Link
                      key={record.campaignLead.id}
                      href={`/outreach/campaign/${data.campaign.id}/leads?leadId=${encodeURIComponent(
                        record.campaignLead.leadId,
                      )}&step=${selectedStep}`}
                      className={`block rounded-[24px] border px-4 py-4 transition ${
                        isActive
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-line bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={`font-medium ${isActive ? "text-white" : "text-slate-950"}`}>
                            {record.lead?.companyName ?? "Unknown lead"}
                          </p>
                          <p className={`mt-1 text-sm ${isActive ? "text-white/80" : "text-slate-600"}`}>
                            {record.contact?.name ?? "No named contact"} ·{" "}
                            {record.finding?.pageLabel ?? record.finding?.pageUrl ?? "No page"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                            isActive ? "bg-white/14 text-white" : getOutreachStateClasses(status)
                          }`}
                        >
                          {formatStateLabel(status)}
                        </span>
                      </div>
                      <p className={`mt-3 text-sm ${isActive ? "text-white/75" : "text-slate-600"}`}>
                        {record.finding?.summary ?? "No proof point captured yet."}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-line px-5 py-16 text-center text-sm text-slate-600">
                  No leads are attached to this campaign yet. Run an audit or regenerate drafts.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedRecord ? (
              <>
                <section className="rounded-[28px] border border-line bg-white/84 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Selected lead</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedRecord.lead?.companyName ?? "Unknown lead"}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {selectedRecord.contact?.name ?? "No contact"}{" "}
                        {selectedRecord.contact?.email ? `· ${selectedRecord.contact.email}` : ""}
                      </p>
                    </div>
                    {selectedRecord.outreachState ? (
                      <OutreachStateSelector
                        stateId={selectedRecord.outreachState.id}
                        value={selectedRecord.outreachState.state}
                      />
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-line bg-slate-50/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Finding</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {selectedRecord.finding?.summary ?? "No issue selected yet"}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {selectedRecord.finding?.recognizableReason ?? "No recognizable reason yet."}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-line bg-slate-50/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Context</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {selectedRecord.lead?.address ?? "No address"} · updated{" "}
                        {formatDateTime(selectedRecord.campaignLead.updatedAt)}
                      </p>
                      {selectedRecord.thread ? (
                        <Link
                          href={`/outreach/inbox?threadId=${encodeURIComponent(selectedRecord.thread.id)}`}
                          className="mt-3 inline-flex rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Open linked thread
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 rounded-[22px] border border-line bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Variable set</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {Object.entries(selectedRecord.variables?.variables ?? {}).map(([key, value]) => (
                        <div key={key} className="rounded-2xl border border-line bg-slate-50/80 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{key}</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {typeof value === "boolean" ? (value ? "yes" : "no") : String(value ?? "—")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-line bg-white/84 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Lead override editor</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Edit this lead&apos;s rendered copy without changing the campaign defaults.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4].map((stepNumber) => (
                        <Link
                          key={stepNumber}
                          href={`/outreach/campaign/${data.campaign.id}/leads?leadId=${encodeURIComponent(
                            selectedRecord.campaignLead.leadId,
                          )}&step=${stepNumber}`}
                          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                            stepNumber === selectedStep
                              ? "bg-slate-950 text-white"
                              : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Day {stepNumber}
                        </Link>
                      ))}
                    </div>
                  </div>

                  {selectedRecord.sequence && selectedSequenceStep ? (
                    <div className="mt-5 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {selectedSequenceStep.sendState}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {selectedSequenceStep.approvalState}
                        </span>
                      </div>

                      <SequenceStepEditor
                        sequenceId={selectedRecord.sequence.id}
                        stepNumber={selectedStep}
                        initialSubject={selectedSequenceStep.subject}
                        initialBody={selectedSequenceStep.body}
                        isSent={selectedSequenceStep.sendState === "sent"}
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <ApproveSequenceButton sequenceId={selectedRecord.sequence.id} />
                        {selectedSequenceStep.sendState !== "sent" ? (
                          <SendSequenceStepButton
                            sequenceId={selectedRecord.sequence.id}
                            stepNumber={selectedStep}
                          />
                        ) : null}
                        {suppressionEmail ? <SuppressRecipientButton email={suppressionEmail} /> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[22px] border border-dashed border-line px-5 py-12 text-center text-sm text-slate-600">
                      No generated sequence is attached to this lead yet.
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="rounded-[28px] border border-dashed border-line bg-white/84 px-5 py-24 text-center text-sm text-slate-600">
                No lead selected yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
