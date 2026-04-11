import Link from "next/link";
import { MailboxConnectOptions } from "@/components/mailbox-connect-options";
import { OutreachShell } from "@/components/outreach-shell";
import { requireAppAccess } from "@/lib/app-auth";
import { getMailboxProviderLabel, mailboxSupportsInboxSync } from "@/lib/sales-machine/mailbox-config";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import {
  getCampaignStatusClasses,
  getMailboxUsage,
  getOutreachShellStats,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

export default async function OutreachMailboxesPage() {
  await requireAppAccess("/outreach/mailboxes");
  const snapshot = await getOutreachSnapshot();
  const connectedMailboxes = snapshot.connectedMailboxes.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <OutreachShell activeNav="mailboxes" title="Mailboxes" stats={getOutreachShellStats(snapshot)}>
      <section className="glass-panel rounded-[28px] p-4 sm:rounded-[34px] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm">Mailbox operator</p>
            <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              Connect Google or SMTP mailboxes and watch send capacity
            </h2>
          </div>
        </div>

        <div className="mt-6">
          <MailboxConnectOptions />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Connected</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{connectedMailboxes.length}</p>
          </div>
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaign assignments</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              {snapshot.campaigns.filter((campaign) => campaign.mailboxId).length}
            </p>
          </div>
          <div className="rounded-[20px] border border-line bg-white/84 p-3.5 sm:rounded-[24px] sm:p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Threads tracked</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{snapshot.emailThreads.length}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {connectedMailboxes.length ? (
            connectedMailboxes.map((mailbox) => {
              const usage = getMailboxUsage(snapshot, mailbox.id);
              const assignedCampaigns = snapshot.campaigns.filter(
                (campaign) => campaign.mailboxId === mailbox.id,
              );

              return (
                <section
                  key={mailbox.id}
                  className="rounded-[28px] border border-line bg-white/84 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-slate-950">{mailbox.email}</h3>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {getMailboxProviderLabel(mailbox)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getCampaignStatusClasses(
                            mailbox.status === "connected" ? "active" : "paused",
                          )}`}
                        >
                          {mailbox.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {mailbox.displayName ?? "Connected mailbox"} · last updated{" "}
                        {formatDateTime(mailbox.updatedAt)}
                      </p>
                      {!mailboxSupportsInboxSync(mailbox) ? (
                        <p className="mt-2 text-xs text-slate-500">
                          SMTP sending is ready. Add full IMAP credentials if you also want inbox sync here.
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={`/outreach/inbox?mailboxId=${encodeURIComponent(mailbox.id)}`}
                      className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Open inbox
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3 md:gap-4">
                    <div className="rounded-[20px] border border-line bg-slate-50/80 p-3.5 sm:rounded-[22px] sm:p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Daily limit</p>
                      <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
                        {mailbox.dailyLimit ?? "Unlimited"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-line bg-slate-50/80 p-3.5 sm:rounded-[22px] sm:p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sent today</p>
                      <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{usage.sentToday}</p>
                    </div>
                    <div className="rounded-[20px] border border-line bg-slate-50/80 p-3.5 sm:rounded-[22px] sm:p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Remaining today
                      </p>
                      <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
                        {usage.remainingToday ?? "Unlimited"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      Assigned campaigns
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {assignedCampaigns.length ? (
                        assignedCampaigns.map((campaign) => (
                          <Link
                            key={campaign.id}
                            href={`/outreach/campaign/${campaign.id}/overview`}
                            className="rounded-full border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            {campaign.name}
                          </Link>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No campaign is assigned to this mailbox yet.</p>
                      )}
                    </div>
                  </div>
                </section>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-dashed border-line bg-white/80 px-6 py-16 text-center text-sm text-slate-600">
              No mailbox connected yet. Use Google Auth or SMTP + IMAP above to enable sending and campaign assignment.
            </div>
          )}
        </div>
      </section>
    </OutreachShell>
  );
}
