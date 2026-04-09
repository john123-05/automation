import Link from "next/link";
import { ApiActionButton } from "@/components/api-action-button";
import { OutreachShell } from "@/components/outreach-shell";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type OutreachPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OutreachPage({ searchParams }: OutreachPageProps) {
  const snapshot = await getOutreachSnapshot();
  const params = (searchParams ? await searchParams : undefined) ?? {};
  const mailboxConnected = typeof params.mailboxConnected === "string" ? params.mailboxConnected : null;
  const mailboxError = typeof params.mailboxError === "string" ? params.mailboxError : null;
  const mailboxOptions = snapshot.connectedMailboxes.filter((candidate) => candidate.status === "connected");

  return (
    <OutreachShell
      activeNav="campaigns"
      title="Campaigns"
      stats={[
        { label: "Campaigns", value: snapshot.campaigns.length.toString() },
        { label: "Leads", value: snapshot.campaignLeads.length.toString() },
        { label: "Ready", value: snapshot.stats.sequencesReadyCount.toString() },
        { label: "Replied / Booked", value: `${snapshot.stats.repliedCount} / ${snapshot.stats.bookedCount}` },
        { label: "Nurture / Closed", value: `${snapshot.stats.nurtureCount} / ${snapshot.stats.closedCount}` },
      ]}
    >
      {mailboxConnected ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Mailbox connected successfully.
        </div>
      ) : null}

      {mailboxError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Mailbox connection error: {mailboxError}
        </div>
      ) : null}

      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted">Campaign board</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              All outreach campaigns in one place
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/outreach/setup"
              className="rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              Build new campaign
            </Link>
            <ApiActionButton endpoint="/api/scheduler/run" label="Run scheduler now" />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[28px] border border-line bg-white/84">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[minmax(240px,2fr)_120px_110px_110px_110px_110px_140px_120px] gap-4 border-b border-line px-5 py-4 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <span>Name</span>
              <span>Service</span>
              <span>Leads</span>
              <span>Ready</span>
              <span>Sent</span>
              <span>Replies</span>
              <span>Mailbox</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-line">
              {snapshot.campaigns.length ? (
                snapshot.campaigns.map((campaign) => {
                  const metrics = snapshot.campaignMetrics.find((candidate) => candidate.campaignId === campaign.id);
                  const mailbox = snapshot.connectedMailboxes.find((candidate) => candidate.id === campaign.mailboxId);

                  return (
                    <Link
                      key={campaign.id}
                      href={`/outreach/campaign/${campaign.id}/overview`}
                      className="grid grid-cols-[minmax(240px,2fr)_120px_110px_110px_110px_110px_140px_120px] gap-4 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-950">{campaign.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          updated {formatDateTime(campaign.updatedAt)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-700">{campaign.serviceKey.replace(/_/g, " ")}</p>
                      <p className="text-sm text-slate-700">{metrics?.leadCount ?? 0}</p>
                      <p className="text-sm text-slate-700">
                        {(metrics?.draftedCount ?? 0) + (metrics?.approvedCount ?? 0)}
                      </p>
                      <p className="text-sm text-slate-700">{metrics?.sentCount ?? 0}</p>
                      <p className="text-sm text-slate-700">{metrics?.repliedCount ?? 0}</p>
                      <p className="text-sm text-slate-700">{mailbox?.email ?? "No mailbox"}</p>
                      <div className="flex items-start">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
                          {campaign.status}
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-5 py-16 text-center text-sm text-slate-600">
                  No campaigns yet. Run an audit, generate a sequence, or create a new campaign in Setup.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox health</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{mailboxOptions.length}</p>
            <p className="mt-2 text-sm text-slate-600">Connected mailbox(es)</p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Suppressed</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {snapshot.suppressionEntries.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">Contacts or domains blocked from sending</p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/84 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Inbox threads</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{snapshot.emailThreads.length}</p>
            <p className="mt-2 text-sm text-slate-600">Tracked reply threads across mailboxes</p>
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
