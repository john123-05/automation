import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignMailboxForm } from "@/components/campaign-mailbox-form";
import { CampaignTabs } from "@/components/campaign-tabs";
import { MailboxConnectOptions } from "@/components/mailbox-connect-options";
import { OutreachShell } from "@/components/outreach-shell";
import { requireAppAccess } from "@/lib/app-auth";
import {
  formatAuditScopeLabel,
  formatServiceLabel,
  getCampaignWorkspaceData,
  getOutreachShellStats,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type CampaignOptionsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function extractLeadDomains(urls: Array<string | null>) {
  const domains = new Set<string>();

  for (const value of urls) {
    if (!value) {
      continue;
    }

    try {
      domains.add(new URL(value).hostname.replace(/^www\./, ""));
    } catch {
      continue;
    }
  }

  return domains;
}

export default async function CampaignOptionsPage({ params }: CampaignOptionsPageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}/options`);
  const data = await getCampaignWorkspaceData(id);

  if (!data) {
    notFound();
  }

  const mailboxOptions = data.snapshot.connectedMailboxes
    .filter((mailbox) => mailbox.status === "connected")
    .map((mailbox) => ({
      id: mailbox.id,
      label: mailbox.displayName ? `${mailbox.displayName} · ${mailbox.email}` : mailbox.email,
    }));
  const campaignEmails = new Set(
    data.leadRecords
      .flatMap((record) => [record.contact?.email ?? null, record.thread?.contactEmail ?? null])
      .filter((value): value is string => Boolean(value)),
  );
  const campaignDomains = extractLeadDomains(data.leadRecords.map((record) => record.lead?.websiteUri ?? null));
  const relevantSuppressions = data.snapshot.suppressionEntries.filter(
    (entry) =>
      (entry.email ? campaignEmails.has(entry.email) : false) ||
      (entry.domain ? campaignDomains.has(entry.domain) : false),
  );

  return (
    <OutreachShell
      activeNav="campaigns"
      title={data.campaign.name}
      subtitle={formatServiceLabel(data.campaign.serviceKey)}
      stats={getOutreachShellStats(data.snapshot)}
    >
      <section className="glass-panel rounded-[34px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Mailbox assignment, source details, and safety controls live here.
          </p>
          <Link
            href="/outreach/mailboxes"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open mailbox operator
          </Link>
        </div>

        <div className="mt-6">
          <CampaignTabs campaignId={data.campaign.id} active="options" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-line bg-white/84 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox assignment</p>
              <div className="mt-4">
                {mailboxOptions.length ? (
                  <CampaignMailboxForm
                    campaignId={data.campaign.id}
                    mailboxId={data.campaign.mailboxId}
                    options={mailboxOptions}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      No connected mailbox available yet. Connect Google Auth or SMTP + IMAP first, then assign it here.
                    </p>
                    <MailboxConnectOptions />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-white/84 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaign source</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <span>Scope</span>
                  <span className="font-semibold text-slate-950">
                    {formatAuditScopeLabel(data.campaign.sourceScope)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Sheet key</span>
                  <span className="font-semibold text-slate-950">{data.campaign.sheetKey ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Source run</span>
                  <span className="font-semibold text-slate-950">{data.campaign.sourceRunId ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Created</span>
                  <span className="font-semibold text-slate-950">
                    {formatDateTime(data.campaign.createdAt)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[28px] border border-line bg-white/84 p-5">
            <div className="border-b border-line pb-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Suppression safety</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Global suppression entries that affect this campaign
              </h2>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[22px] border border-line bg-white">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[180px_160px_minmax(180px,1fr)_120px] gap-4 border-b border-line px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <span>Email / Domain</span>
                  <span>Source</span>
                  <span>Reason</span>
                  <span>Created</span>
                </div>

                <div className="divide-y divide-line">
                  {(relevantSuppressions.length ? relevantSuppressions : data.snapshot.suppressionEntries).length ? (
                    (relevantSuppressions.length ? relevantSuppressions : data.snapshot.suppressionEntries).map((entry) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[180px_160px_minmax(180px,1fr)_120px] gap-4 px-4 py-3 text-sm text-slate-700"
                      >
                        <span>{entry.email ?? entry.domain ?? "—"}</span>
                        <span>{entry.source}</span>
                        <span>{entry.reason}</span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-14 text-center text-sm text-slate-600">
                      No suppression entries yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </OutreachShell>
  );
}
