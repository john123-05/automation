import { notFound } from "next/navigation";
import { ApiActionButton } from "@/components/api-action-button";
import { CampaignScheduleForm } from "@/components/campaign-schedule-form";
import { CampaignTabs } from "@/components/campaign-tabs";
import { OutreachShell } from "@/components/outreach-shell";
import { requireAppAccess } from "@/lib/app-auth";
import {
  formatServiceLabel,
  getCampaignWorkspaceData,
  getMailboxUsage,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type CampaignSchedulePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CampaignSchedulePage({ params }: CampaignSchedulePageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}/schedule`);
  const data = await getCampaignWorkspaceData(id);

  if (!data) {
    notFound();
  }

  const mailboxUsage = data.mailbox ? getMailboxUsage(data.snapshot, data.mailbox.id) : null;
  const scheduledSteps = data.sequences.flatMap((sequence) =>
    sequence.steps.filter((step) => step.sendState === "scheduled"),
  ).length;

  return (
    <OutreachShell
      activeNav="campaigns"
      title={data.campaign.name}
      subtitle={formatServiceLabel(data.campaign.serviceKey)}
      stats={[
        { label: "Approved", value: data.metrics.approvedCount.toString() },
        { label: "Scheduled", value: data.metrics.scheduledCount.toString() },
        { label: "Queued steps", value: scheduledSteps.toString() },
        { label: "Sent", value: data.metrics.sentCount.toString() },
        { label: "Mailbox", value: data.mailbox ? "Connected" : "Missing" },
        { label: "Stop on reply", value: data.campaign.stopOnReply ? "On" : "Off" },
      ]}
    >
      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Scheduling turns approved steps into timed sends and honors mailbox limits.
          </p>
          <div className="flex flex-wrap gap-2">
            <ApiActionButton endpoint={`/api/campaigns/${data.campaign.id}/approve`} label="Approve all drafts" />
            <ApiActionButton
              endpoint={`/api/campaigns/${data.campaign.id}/${data.campaign.status === "active" ? "pause" : "activate"}`}
              label={data.campaign.status === "active" ? "Pause campaign" : "Activate campaign"}
            />
            <ApiActionButton endpoint="/api/scheduler/run" label="Run scheduler now" />
          </div>
        </div>

        <div className="mt-6">
          <CampaignTabs campaignId={data.campaign.id} active="schedule" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-line bg-white/84 p-5">
            <div className="border-b border-line pb-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Send rules</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Time window, weekdays, and escalation delay
              </h2>
            </div>

            <div className="mt-5">
              <CampaignScheduleForm
                campaignId={data.campaign.id}
                timezone={data.campaign.timezone}
                sendWindowStart={data.campaign.sendWindowStart}
                sendWindowEnd={data.campaign.sendWindowEnd}
                allowedWeekdays={data.campaign.allowedWeekdays}
                stopOnReply={data.campaign.stopOnReply}
                waitHoursAfterFinalStep={data.campaign.waitHoursAfterFinalStep}
              />
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-line bg-white/84 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox capacity</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {data.mailbox?.email ?? "No mailbox assigned"}
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <span>Daily limit</span>
                  <span className="font-semibold text-slate-950">
                    {data.mailbox?.dailyLimit ?? "Unlimited"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Sent today</span>
                  <span className="font-semibold text-slate-950">{mailboxUsage?.sentToday ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Remaining today</span>
                  <span className="font-semibold text-slate-950">
                    {mailboxUsage?.remainingToday ?? "Unlimited"}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-white/84 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Cadence preview</p>
              <div className="mt-4 space-y-3">
                {data.steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-line bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
                  >
                    <span>Step {step.stepNumber}</span>
                    <span>Day {step.dayOffset + 1}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Final-step escalation fires after {data.campaign.waitHoursAfterFinalStep} hours if no
                reply lands and the lead stays active.
              </p>
            </section>

            <section className="rounded-[28px] border border-line bg-white/84 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Recent activity</p>
              <p className="mt-2 text-sm text-slate-600">
                Last thread: {data.latestThread ? formatDateTime(data.latestThread.updatedAt) : "Not yet"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Last sequence run:{" "}
                {data.latestGenerationRun ? formatDateTime(data.latestGenerationRun.startedAt) : "Not yet"}
              </p>
            </section>
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
