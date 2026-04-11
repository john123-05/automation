import Link from "next/link";
import { InboxSyncButton } from "@/components/inbox-sync-button";
import { ManualReplyForm } from "@/components/manual-reply-form";
import { OutreachShell } from "@/components/outreach-shell";
import { OutreachStateSelector } from "@/components/outreach-state-selector";
import { SuppressRecipientButton } from "@/components/suppress-recipient-button";
import { requireAppAccess } from "@/lib/app-auth";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import {
  formatServiceLabel,
  formatStateLabel,
  getCampaignStatusClasses,
  getOutreachShellStats,
  getOutreachStateClasses,
} from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

type OutreachInboxPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function OutreachInboxPage({ searchParams }: OutreachInboxPageProps) {
  await requireAppAccess("/outreach/inbox");
  const snapshot = await getOutreachSnapshot();
  const params = (searchParams ? await searchParams : undefined) ?? {};
  const activeMailboxId = readParam(params.mailboxId);
  const activeCampaignId = readParam(params.campaignId);
  const activeState = readParam(params.state);
  const activeThreadId = readParam(params.threadId);

  const filteredThreads = snapshot.emailThreads
    .filter((thread) => (activeMailboxId ? thread.mailboxId === activeMailboxId : true))
    .filter((thread) => (activeCampaignId ? thread.campaignId === activeCampaignId : true))
    .filter((thread) => (activeState ? thread.state === activeState : true))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const selectedThread =
    (activeThreadId ? filteredThreads.find((thread) => thread.id === activeThreadId) : null) ??
    filteredThreads[0] ??
    null;
  const selectedMessages = selectedThread
    ? snapshot.emailMessages
        .filter((message) => message.threadId === selectedThread.id)
        .sort((a, b) => {
          const aValue = a.sentAt ?? a.createdAt;
          const bValue = b.sentAt ?? b.createdAt;
          return aValue.localeCompare(bValue);
        })
    : [];
  const selectedCampaign = selectedThread?.campaignId
    ? snapshot.campaigns.find((campaign) => campaign.id === selectedThread.campaignId) ?? null
    : null;
  const selectedLead = selectedThread?.leadId
    ? snapshot.leads.find((lead) => lead.id === selectedThread.leadId) ?? null
    : null;
  const selectedStateRecord =
    selectedThread == null
      ? null
      : snapshot.outreachStates.find(
          (state) =>
            state.threadId === selectedThread.id ||
            (selectedThread.sequenceId ? state.sequenceId === selectedThread.sequenceId : false),
        ) ?? null;

  function buildInboxHref(updates: Record<string, string | null | undefined>) {
    const next = new URLSearchParams();
    const merged = {
      mailboxId: activeMailboxId,
      campaignId: activeCampaignId,
      state: activeState,
      threadId: activeThreadId,
      ...updates,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        next.set(key, value);
      }
    }

    return `/outreach/inbox${next.size ? `?${next.toString()}` : ""}`;
  }

  return (
    <OutreachShell activeNav="inbox" title="Inbox" stats={getOutreachShellStats(snapshot)}>
      <section className="glass-panel rounded-[28px] p-4 sm:rounded-[34px] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm">
              Operator inbox
            </p>
            <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
              Replies, thread state, and manual follow-up
            </h2>
          </div>
          <InboxSyncButton mailboxId={activeMailboxId} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[220px_300px_minmax(0,1fr)] xl:grid-cols-[240px_360px_minmax(0,1fr)] xl:gap-5">
          <aside className="space-y-5 rounded-[28px] border border-line bg-white/84 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mailbox</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={buildInboxHref({ mailboxId: null, threadId: null })}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                    activeMailboxId == null
                      ? "bg-slate-950 text-white"
                      : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  All inboxes
                </Link>
                {snapshot.connectedMailboxes.map((mailbox) => (
                  <Link
                    key={mailbox.id}
                    href={buildInboxHref({ mailboxId: mailbox.id, threadId: null })}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                      activeMailboxId === mailbox.id
                        ? "bg-slate-950 text-white"
                        : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {mailbox.email}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">State</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[null, "replied", "booked", "nurture", "closed", "sent", "scheduled"].map((state) => (
                  <Link
                    key={state ?? "all"}
                    href={buildInboxHref({ state, threadId: null })}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                      (state ?? null) === activeState
                        ? "bg-slate-950 text-white"
                        : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {state ? formatStateLabel(state) : "All states"}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaign</p>
              <div className="mt-3 space-y-2">
                <Link
                  href={buildInboxHref({ campaignId: null, threadId: null })}
                  className={`block rounded-[18px] px-3 py-2 text-sm font-medium transition ${
                    activeCampaignId == null
                      ? "bg-slate-950 text-white"
                      : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  All campaigns
                </Link>
                {snapshot.campaigns.slice(0, 8).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={buildInboxHref({ campaignId: campaign.id, threadId: null })}
                    className={`block rounded-[18px] px-3 py-2 text-sm transition ${
                      activeCampaignId === campaign.id
                        ? "bg-slate-950 text-white"
                        : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium">{campaign.name}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                      activeCampaignId === campaign.id
                        ? "bg-white/12 text-white"
                        : getCampaignStatusClasses(campaign.status)
                    }`}>
                      {campaign.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-line bg-white/84 p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Thread list</p>
            <div className="mt-4 space-y-3">
              {filteredThreads.length ? (
                filteredThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={buildInboxHref({ threadId: thread.id })}
                    className={`block rounded-[22px] border px-4 py-4 transition ${
                      thread.id === selectedThread?.id
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-line bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className={`font-medium ${thread.id === selectedThread?.id ? "text-white" : "text-slate-950"}`}>
                          {thread.subject}
                        </p>
                        <p className={`mt-1 text-sm ${thread.id === selectedThread?.id ? "text-white/80" : "text-slate-600"}`}>
                          {thread.contactName ?? thread.contactEmail ?? "Unknown contact"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                          thread.id === selectedThread?.id
                            ? "bg-white/12 text-white"
                            : getOutreachStateClasses(thread.state)
                        }`}
                      >
                        {formatStateLabel(thread.state)}
                      </span>
                    </div>
                    <p className={`mt-3 text-sm ${thread.id === selectedThread?.id ? "text-white/75" : "text-slate-600"}`}>
                      {thread.snippet ?? "No snippet available"}
                    </p>
                    <p className={`mt-3 text-xs ${thread.id === selectedThread?.id ? "text-white/60" : "text-slate-500"}`}>
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-line px-5 py-16 text-center text-sm text-slate-600">
                  No threads match the current filters yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white/84 p-4 sm:p-5">
            {selectedThread ? (
              <>
                <div className="border-b border-line pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Thread detail</p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">{selectedThread.subject}</h2>
                    </div>
                    {selectedStateRecord ? (
                      <OutreachStateSelector
                        stateId={selectedStateRecord.id}
                        value={selectedStateRecord.state}
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedCampaign ? `${selectedCampaign.name} · ` : ""}
                    {selectedLead?.companyName ?? selectedThread.contactName ?? selectedThread.contactEmail ?? "Unknown lead"}
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-[22px] border border-line bg-slate-50/80 p-4 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedThread.serviceKey ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {formatServiceLabel(selectedThread.serviceKey)}
                        </span>
                      ) : null}
                      {selectedThread.contactEmail ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {selectedThread.contactEmail}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Last updated {formatDateTime(selectedThread.updatedAt)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-[22px] border px-4 py-4 ${
                          message.direction === "outbound"
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-line bg-white text-slate-800"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className={`text-xs uppercase tracking-[0.18em] ${
                            message.direction === "outbound" ? "text-white/70" : "text-slate-500"
                          }`}>
                            {message.direction}
                          </span>
                          <span className={`text-xs ${
                            message.direction === "outbound" ? "text-white/70" : "text-slate-500"
                          }`}>
                            {formatDateTime(message.sentAt ?? message.createdAt)}
                          </span>
                        </div>
                        <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${
                          message.direction === "outbound" ? "text-white" : "text-slate-700"
                        }`}>
                          {message.bodyText}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                    {selectedThread.mailboxId && selectedThread.contactEmail ? (
                      <ManualReplyForm
                        mailboxId={selectedThread.mailboxId}
                        threadId={selectedThread.id}
                        toEmail={selectedThread.contactEmail}
                        defaultSubject={selectedThread.subject.startsWith("Re:")
                          ? selectedThread.subject
                          : `Re: ${selectedThread.subject}`}
                      />
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-line px-5 py-12 text-center text-sm text-slate-600">
                        This thread cannot be replied to yet because the recipient or mailbox is missing.
                      </div>
                    )}

                    {selectedThread.contactEmail ? (
                      <SuppressRecipientButton email={selectedThread.contactEmail} />
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line px-5 py-24 text-center text-sm text-slate-600">
                Select a thread to inspect the conversation and reply.
              </div>
            )}
          </section>
        </div>
      </section>
    </OutreachShell>
  );
}
