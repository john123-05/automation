import Link from "next/link";
import { ApiActionButton } from "@/components/api-action-button";
import { OutreachShell } from "@/components/outreach-shell";
import { requireAppAccess } from "@/lib/app-auth";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type OutreachPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OutreachPage({ searchParams }: OutreachPageProps) {
  await requireAppAccess("/outreach");
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

      <section className="glass-panel rounded-[26px] p-4 sm:rounded-[34px] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted sm:text-sm">Campaign board</p>
            <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              All outreach campaigns in one place
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/outreach/setup"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              Build new campaign
            </Link>
            <ApiActionButton endpoint="/api/scheduler/run" label="Run scheduler now" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:hidden">
          {snapshot.campaigns.length ? (
            snapshot.campaigns.map((campaign) => {
              const metrics = snapshot.campaignMetrics.find((candidate) => candidate.campaignId === campaign.id);
              const mailbox = snapshot.connectedMailboxes.find((candidate) => candidate.id === campaign.mailboxId);

              return (
                <Link
                  key={campaign.id}
                  href={`/outreach/campaign/${campaign.id}/overview`}
                  className="block rounded-[22px] border border-line bg-white/84 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight text-slate-950">{campaign.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {campaign.serviceKey.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-800">
                      {campaign.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-[16px] border border-line bg-white px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Leads</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{metrics?.leadCount ?? 0}</p>
                    </div>
                    <div className="rounded-[16px] border border-line bg-white px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Ready</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">
                        {(metrics?.draftedCount ?? 0) + (metrics?.approvedCount ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-line bg-white px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Sent</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{metrics?.sentCount ?? 0}</p>
                    </div>
                    <div className="rounded-[16px] border border-line bg-white px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Replies</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{metrics?.repliedCount ?? 0}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <p>Mailbox: {mailbox?.email ?? "No mailbox"}</p>
                    <p>Updated {formatDateTime(campaign.updatedAt)}</p>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-[22px] border border-line bg-white/84 px-4 py-10 text-center text-sm text-slate-600">
              No campaigns yet. Run an audit, generate a sequence, or create a new campaign in Setup.
            </div>
          )}
        </div>

        <div className="mt-6 hidden overflow-x-auto rounded-[28px] border border-line bg-white/84 xl:block">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:mt-5 lg:gap-4">
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox health</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{mailboxOptions.length}</p>
            <p className="mt-1.5 text-xs text-slate-600 sm:mt-2 sm:text-sm">Connected mailbox(es)</p>
          </div>
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Suppressed</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              {snapshot.suppressionEntries.length}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 sm:mt-2 sm:text-sm">Contacts or domains blocked from sending</p>
          </div>
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Inbox threads</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{snapshot.emailThreads.length}</p>
            <p className="mt-1.5 text-xs text-slate-600 sm:mt-2 sm:text-sm">Tracked reply threads across mailboxes</p>
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
