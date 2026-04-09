import { notFound } from "next/navigation";
import { ApiActionButton } from "@/components/api-action-button";
import { CampaignTabs } from "@/components/campaign-tabs";
import { OutreachShell } from "@/components/outreach-shell";
import { requireAppAccess } from "@/lib/app-auth";
import {
  formatAuditScopeLabel,
  formatServiceLabel,
  getCampaignStatusClasses,
  getCampaignWorkspaceData,
  getOutreachStateClasses,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type CampaignOverviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CampaignOverviewPage({ params }: CampaignOverviewPageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}/overview`);
  const data = await getCampaignWorkspaceData(id);

  if (!data) {
    notFound();
  }

  const { campaign, metrics, mailbox, latestAuditJob, latestGenerationRun, latestThread } = data;
  const auditBatchSize = Math.max(5, Math.min(25, metrics.leadCount || 10));

  return (
    <OutreachShell
      activeNav="campaigns"
      title={campaign.name}
      subtitle={formatServiceLabel(campaign.serviceKey)}
      stats={[
        { label: "Leads", value: metrics.leadCount.toString() },
        { label: "Ready", value: `${metrics.draftedCount + metrics.approvedCount}` },
        { label: "Scheduled", value: metrics.scheduledCount.toString() },
        { label: "Sent", value: metrics.sentCount.toString() },
        { label: "Replies / Booked", value: `${metrics.repliedCount} / ${metrics.bookedCount}` },
        {
          label: "Nurture / Closed",
          value: `${metrics.nurtureCount} / ${metrics.closedCount}`,
        },
      ]}
    >
      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getCampaignStatusClasses(
                  campaign.status,
                )}`}
              >
                {campaign.status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {formatAuditScopeLabel(campaign.sourceScope)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {campaign.timezone}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {mailbox ? `Mailbox: ${mailbox.email}` : "No mailbox assigned yet"} · updated{" "}
              {formatDateTime(campaign.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ApiActionButton
              endpoint="/api/audits/run"
              label="Run audit now"
              body={{
                campaignId: campaign.id,
                serviceKey: campaign.serviceKey,
                scope: campaign.sourceScope,
                sourceRunId: campaign.sourceRunId,
                sheetKey: campaign.sheetKey,
                batchSize: auditBatchSize,
              }}
            />
            <ApiActionButton endpoint={`/api/campaigns/${campaign.id}/regenerate`} label="Regenerate drafts" />
            <ApiActionButton endpoint={`/api/campaigns/${campaign.id}/approve`} label="Approve campaign" />
            <ApiActionButton
              endpoint={`/api/campaigns/${campaign.id}/${campaign.status === "active" ? "pause" : "activate"}`}
              label={campaign.status === "active" ? "Pause campaign" : "Activate campaign"}
            />
          </div>
        </div>

        <div className="mt-6">
          <CampaignTabs campaignId={campaign.id} active="overview" />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{mailbox?.email ?? "Unassigned"}</p>
            <p className="mt-2 text-sm text-slate-600">
              {mailbox ? "Connected and ready for scheduling." : "Assign a Gmail mailbox in Options."}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Latest audit</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {latestAuditJob ? `${latestAuditJob.findingsCreated} finding(s)` : "Not run yet"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {latestAuditJob ? formatDateTime(latestAuditJob.updatedAt) : "Run the service lens first."}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Latest generation</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {latestGenerationRun?.summary ?? "No sequence run yet"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {latestGenerationRun ? formatDateTime(latestGenerationRun.startedAt) : "Generate drafts after the audit."}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Latest thread</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {latestThread?.subject ?? "No inbox thread yet"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {latestThread ? formatDateTime(latestThread.updatedAt) : "Replies will surface here."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[28px] border border-line bg-white/84 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sequence funnel</p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {[
                ["Drafted", metrics.draftedCount],
                ["Approved", metrics.approvedCount],
                ["Scheduled", metrics.scheduledCount],
                ["Sent", metrics.sentCount],
                ["Replied", metrics.repliedCount],
                ["Booked", metrics.bookedCount],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span>{label}</span>
                  <span className="font-semibold text-slate-950">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-white/84 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Current lifecycle pressure</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "replied", value: metrics.repliedCount },
                { label: "booked", value: metrics.bookedCount },
                { label: "nurture", value: metrics.nurtureCount },
                { label: "closed", value: metrics.closedCount },
                { label: "needs_escalation", value: metrics.needsEscalationCount },
              ].map(({ label, value }) => (
                <span
                  key={label}
                  className={`rounded-full px-3 py-2 text-xs font-medium ${getOutreachStateClasses(
                    label,
                  )}`}
                >
                  {label.replace(/_/g, " ")} · {value}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Replies and manual state changes stop future sends automatically when the campaign is
              configured with stop-on-reply.
            </p>
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
