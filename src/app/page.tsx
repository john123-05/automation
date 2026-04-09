import Link from "next/link";
import { deleteRunAction } from "@/app/actions";
import { BillingCardPanel } from "@/components/billing-card-panel";
import { DashboardInboxPreview } from "@/components/dashboard-inbox-preview";
import { EmailWarmupCard } from "@/components/email-warmup-card";
import { EnrichLeadsForm } from "@/components/enrich-leads-form";
import { MobileQuickActionsBar } from "@/components/mobile-quick-actions-bar";
import { QuickAddCompanyModal } from "@/components/quick-add-company-modal";
import { QuickAddContactModal } from "@/components/quick-add-contact-modal";
import { RunHistoryPreview } from "@/components/run-history-preview";
import { SearchLeadsForm } from "@/components/search-leads-form";
import { SettingsButton } from "@/components/settings-button";
import { UniversalSearchLauncher } from "@/components/universal-search-launcher";
import { t } from "@/lib/copy";
import { listWarmupAccounts } from "@/lib/email-warmup-server";
import { getProviderStatuses, getStorageMode } from "@/lib/env";
import { getDashboardSnapshot } from "@/lib/sales-machine/store";
import { probeSupabaseTable, salesMachineTables } from "@/lib/sales-machine/supabase";
import type { Contact, Lead, RunKind, RunStatus, WorkflowRun } from "@/lib/sales-machine/types";
import { formatDateTime } from "@/lib/sales-machine/utils";
import { getUiSettings } from "@/lib/ui-settings";

function statusClasses(status: Lead["stage"]) {
  switch (status) {
    case "enriched":
      return "bg-emerald-100 text-emerald-800";
    case "discovered":
      return "bg-cyan-100 text-cyan-900";
    case "contact_missing":
      return "bg-amber-100 text-amber-900";
    case "error":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function runStatusClasses(status: RunStatus) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "running":
      return "bg-cyan-100 text-cyan-900";
    case "failed":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function kindLabel(kind: RunKind) {
  switch (kind) {
    case "lead-search":
      return "Lead Search";
    case "contact-enrichment":
      return "Contact Enrichment";
    case "website-audit":
      return "Website Audit";
    case "sequence-generation":
      return "Sequence Generation";
    case "message-send":
      return "Message Send";
    case "inbox-sync":
      return "Inbox Sync";
    default:
      return "Run";
  }
}

function contactsForLead(contacts: Contact[], leadId: string) {
  return contacts.filter((contact) => contact.leadId === leadId);
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="glass-panel rounded-[24px] p-4">
      <p className="text-sm uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}
    </div>
  );
}

function RunCard({ run }: { run: WorkflowRun }) {
  const deleteRunWithId = deleteRunAction.bind(null, run.id);

  return (
    <details className="glass-panel relative rounded-[28px] p-5" open={run.status === "failed"}>
      <form action={deleteRunWithId} className="absolute right-4 top-4 z-10">
        <button
          type="submit"
          aria-label={`Delete run ${run.id}`}
          className="flex size-8 items-center justify-center rounded-full border border-line bg-white/90 text-sm font-semibold text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          title="Delete this run"
        >
          ×
        </button>
      </form>

      <summary className="cursor-pointer list-none pr-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{kindLabel(run.kind)}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              {run.summary ?? "Run in progress"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">Started {formatDateTime(run.startedAt)}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${runStatusClasses(run.status)}`}
          >
            {run.status}
          </span>
        </div>
      </summary>

      <div className="mt-5 space-y-3 border-t border-line pt-4">
        {run.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {run.error}
          </div>
        ) : null}

        {run.steps.map((step) => (
          <div key={step.id} className="rounded-2xl border border-line bg-white/70 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm text-slate-600">{step.message}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${runStatusClasses(step.status)}`}
              >
                {step.status}
              </span>
            </div>
            {step.details ? (
              <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100">
                {step.details}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function LeadCard({ lead, contacts }: { lead: Lead; contacts: Contact[] }) {
  return (
    <details id={`lead-${lead.id}`} className="glass-panel rounded-[28px] p-5 scroll-mt-24">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-950">{lead.companyName}</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(lead.stage)}`}
              >
                {lead.stage}
              </span>
            </div>
            <p className="text-sm text-slate-600">{lead.address}</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{lead.niche}</span>
              <span>•</span>
              <span>{lead.locationLabel}</span>
              <span>•</span>
              <span>{lead.contactCount} contacts</span>
            </div>
          </div>

          <div className="text-right text-sm text-slate-600">
            <p>Updated {formatDateTime(lead.updatedAt)}</p>
            <p className="mt-1">
              {lead.websiteUri ? (
                <a className="underline decoration-dotted" href={lead.websiteUri}>
                  Visit site
                </a>
              ) : (
                "No website"
              )}
            </p>
          </div>
        </div>
      </summary>

      <div className="mt-5 grid gap-4 border-t border-line pt-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-line bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Lead context</p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Website:</span>{" "}
              {lead.websiteUri ? (
                <a className="underline decoration-dotted" href={lead.websiteUri}>
                  {lead.websiteUri}
                </a>
              ) : (
                "Not returned by Google Places"
              )}
            </p>
            <p>
              <span className="font-medium text-slate-900">Phone:</span>{" "}
              {lead.internationalPhoneNumber ?? lead.nationalPhoneNumber ?? "Not returned"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Rating:</span>{" "}
              {lead.rating ?? "Unknown"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Last error:</span>{" "}
              {lead.lastError ?? "None"}
            </p>
          </div>

          {lead.researchSummary ? (
            <div className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-slate-800">
              {lead.researchSummary}
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-line bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Contacts</p>
          <div className="mt-3 space-y-3">
            {contacts.length ? (
              contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{contact.name}</p>
                      <p className="text-sm text-slate-600">{contact.title ?? "Unknown role"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {contact.confidence}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <p>Email: {contact.email ?? "NA"}</p>
                    <p>LinkedIn: {contact.linkedin ?? "NA"}</p>
                    <p>Instagram: {contact.instagram ?? "NA"}</p>
                    <p>Twitter/X: {contact.twitter ?? "NA"}</p>
                    <p>Facebook: {contact.facebook ?? "NA"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No contacts saved yet. Run enrichment to research likely decision-makers.
              </p>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function formatSearchRunLabel(
  run: WorkflowRun,
  leadCount: number,
) {
  const niche =
    typeof run.input.niche === "string" && run.input.niche.trim()
      ? run.input.niche.trim()
      : "Unknown niche";
  const location =
    typeof run.input.location === "string" && run.input.location.trim()
      ? run.input.location.trim()
      : "Unknown location";

  return `${niche} in ${location} • ${leadCount} lead${leadCount === 1 ? "" : "s"}`;
}

type DashboardNotice = {
  id: string;
  title: string;
  message: string;
  tone: "amber" | "rose";
};

export default async function Home() {
  const { language, theme } = await getUiSettings();
  const snapshot = await getDashboardSnapshot(getProviderStatuses());
  const warmupAccounts = await listWarmupAccounts();
  const displayedInboxThreads = snapshot.emailThreads.slice(0, 20);
  const searchRunOptions = snapshot.runs
    .filter((run) => run.kind === "lead-search" && run.status === "completed")
    .map((run) => {
      const leadCount = snapshot.leads.filter((lead) => lead.searchRunId === run.id).length;

      return {
        id: run.id,
        label: formatSearchRunLabel(run, leadCount),
      };
    });
  const notices: DashboardNotice[] = [];
  const trialCreditsCard = snapshot.billingOverview.cards.find((card) => card.id === "trial-credits");
  const openAiCard = snapshot.billingOverview.cards.find((card) => card.id === "openai");

  if (process.env.VERCEL && !process.env.APP_ACCESS_PASSWORD?.trim()) {
    notices.push({
      id: "app-auth-missing",
      title: "Website is currently public",
      message:
        "APP_ACCESS_PASSWORD is not active in the hosted environment yet, so anyone with the URL can open the app. Add the password in Vercel Production env vars and redeploy.",
      tone: "rose",
    });
  }

  if (trialCreditsCard && trialCreditsCard.status !== "ready") {
    notices.push({
      id: "trial-credits-hosted",
      title: "Trial Credits are using fallback data",
      message:
        trialCreditsCard.summary ||
        "BigQuery-derived billing is not fully available on this deployment, so the card is using fallback values.",
      tone: "amber",
    });
  }

  if (openAiCard && openAiCard.status !== "ready") {
    notices.push({
      id: "openai-billing-hosted",
      title: "OpenAI billing is not fully configured",
      message:
        openAiCard.summary ||
        "The OpenAI organization billing API is not returning data on this deployment yet.",
      tone: openAiCard.status === "error" ? "rose" : "amber",
    });
  }

  if (getStorageMode() === "supabase") {
    const mailboxTableChecks = await Promise.all([
      probeSupabaseTable(salesMachineTables.connectedMailboxes),
      probeSupabaseTable(salesMachineTables.emailThreads),
      probeSupabaseTable(salesMachineTables.emailMessages),
    ]);
    const missingMailTables = mailboxTableChecks.filter((entry) => !entry.exists);

    if (missingMailTables.length > 0) {
      notices.push({
        id: "supabase-outreach-schema",
        title: "Hosted inbox tables are missing",
        message:
          "Supabase has your leads and contacts, but the outreach mail tables are not present in the hosted database yet. Apply the latest supabase/schema.sql to create connected_mailboxes, email_threads, and email_messages.",
        tone: "rose",
      });
    } else if (!snapshot.emailThreads.length) {
      notices.push({
        id: "hosted-inbox-empty",
        title: "Hosted inbox is connected but empty",
        message:
          "The mail tables exist, but this deployment does not have synced mailbox/thread data yet. Run an inbox sync on the hosted app after the mailbox records have been migrated.",
        tone: "amber",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-8 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-6">
      <section className="glass-panel relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(17,100,102,0.18),transparent_72%)] lg:block" />
        <div className="relative">
          <div className="w-full max-w-[980px]">
            <h1 className="mt-2 text-[clamp(1.65rem,4vw,3.9rem)] font-semibold leading-[0.98] text-slate-950">
              {t(language, "leanMeanLeadFinderMachine")}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/workspace"
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition ${
                  theme === "dark"
                    ? "bg-slate-100 text-[#111315] hover:bg-white"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                {t(language, "openContactTable")}
              </Link>
              <Link
                href="/outreach"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
              >
                {t(language, "outreachEngine")}
              </Link>
              <QuickAddCompanyModal
                returnPath="/"
                language={language}
                triggerClassName="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              />
              <QuickAddContactModal
                leads={snapshot.leads}
                returnPath="/"
                language={language}
                triggerClassName="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              />
              <Link
                href="/documents"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
              >
                {t(language, "documentation")}
              </Link>
              <UniversalSearchLauncher
                leads={snapshot.leads}
                contacts={snapshot.contacts}
                language={language}
              />
              <SettingsButton language={language} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="mr-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                APIs
              </p>
              {snapshot.providerStatuses.map((provider) => (
                <div
                  key={provider.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/75 px-2.5 py-1.5"
                >
                  <span
                    className={`status-dot ${
                      provider.connected ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <p className="text-[11px] font-medium text-slate-900">{provider.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {notices.length ? (
        <section className="space-y-3">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`rounded-[26px] border px-5 py-4 ${
                notice.tone === "rose"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Hosted check</p>
              <p className="mt-2 text-base font-semibold">{notice.title}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{notice.message}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.billingOverview.cards.map((card) => (
            <BillingCardPanel key={card.id} {...card} />
          ))}
          <EmailWarmupCard initialAccounts={warmupAccounts} language={language} />
          <DashboardInboxPreview language={language} threads={displayedInboxThreads} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="contents xl:col-span-4 xl:grid xl:grid-cols-4 xl:gap-4">
          <StatCard label="Leads" value={snapshot.stats.leadCount.toString()} detail="" />
          <StatCard label="Enriched" value={snapshot.stats.enrichedLeadCount.toString()} detail="" />
          <StatCard label={t(language, "contacts")} value={snapshot.stats.contactCount.toString()} detail="" />
          <StatCard label="Need Attention" value={snapshot.stats.failedLeadCount.toString()} detail="" />
        </div>

        <div className="xl:col-span-1">
          <RunHistoryPreview runs={snapshot.runs} language={language}>
            <div className="space-y-4">
              {snapshot.runs.length ? (
                snapshot.runs.slice(0, 8).map((run) => <RunCard key={run.id} run={run} />)
              ) : (
                <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-slate-600">
                  {t(language, "noRunsYet")}
                </p>
              )}
            </div>
          </RunHistoryPreview>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel rounded-[32px] p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "search")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t(language, "findLeads")}</h2>
          </div>
          <SearchLeadsForm language={language} />
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "enrich")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t(language, "enrichContacts")}</h2>
          </div>
          <EnrichLeadsForm searchRunOptions={searchRunOptions} language={language} />
        </div>
      </section>

      <section id="lead-workspace" className="glass-panel rounded-[32px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "leadWorkspace")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {t(language, "leadsAndContacts")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600">
              {t(language, "showingLatestThree")}
            </p>
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              {t(language, "openTableView")}
            </Link>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {snapshot.leads.length ? (
            snapshot.leads.slice(0, 3).map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                contacts={contactsForLead(snapshot.contacts, lead.id)}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-12 text-center text-sm text-slate-600">
              {t(language, "noLeadsYet")}
            </p>
          )}
        </div>
      </section>

      <MobileQuickActionsBar>
        <QuickAddCompanyModal
          returnPath="/"
          language={language}
          triggerClassName="inline-flex flex-1 items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        />
        <QuickAddContactModal
          leads={snapshot.leads}
          returnPath="/"
          language={language}
          triggerClassName="inline-flex flex-1 items-center justify-center rounded-full border border-line bg-white/85 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
        />
      </MobileQuickActionsBar>
    </main>
  );
}
