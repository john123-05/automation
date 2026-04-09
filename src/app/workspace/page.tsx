import Link from "next/link";
import {
  addActivityNoteAction,
  bulkUpdateLeadCrmAction,
  convertOpportunityToClientAction,
  createMeetingAction,
  createOpportunityAction,
  createProjectAction,
  createReminderAction,
  createReportingConnectionAction,
  deleteRunAction,
  deleteSheetAction,
  generateMonthlyReportAction,
  generateProposalAction,
  requestClientAssetAction,
  renameSheetAction,
  updateOpportunityStageAction,
  updateProjectTaskAction,
  updateProposalStatusAction,
  updateLeadCrmAction,
} from "@/app/actions";
import { MobileQuickActionsBar } from "@/components/mobile-quick-actions-bar";
import { MobileDrawer } from "@/components/mobile-drawer";
import { SequenceStepEditor } from "@/components/sequence-step-editor";
import { QuickAddCompanyModal } from "@/components/quick-add-company-modal";
import { QuickAddContactModal } from "@/components/quick-add-contact-modal";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import {
  buildWorkspaceCompanyRecords,
  formatNextActionLabel,
  formatPriorityLabel,
  formatWorkspaceStageLabel,
  getWorkspaceKpis,
  getWorkspaceStageClasses,
  groupWorkspacePipeline,
  workspaceTabs,
} from "@/lib/sales-machine/workspace-crm";
import { formatServiceLabel, getCampaignStatusClasses, getOutreachStateClasses } from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";
import {
  buildWorkspaceSheets,
  isNonEmptyString,
} from "@/lib/sales-machine/workspace-sheets";
import type { WorkspaceTab } from "@/lib/sales-machine/types";

export const dynamic = "force-dynamic";

type WorkspacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? null : null;
}

function statusClasses(status: string) {
  switch (status) {
    case "completed":
    case "enriched":
      return "bg-emerald-100 text-emerald-800";
    case "running":
    case "discovered":
      return "bg-cyan-100 text-cyan-900";
    case "contact_missing":
      return "bg-amber-100 text-amber-900";
    case "failed":
    case "error":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function opportunityStageClasses(stage: string) {
  switch (stage) {
    case "won":
      return "bg-emerald-50 text-emerald-700";
    case "lost":
      return "bg-rose-50 text-rose-700";
    case "meeting_booked":
      return "bg-sky-50 text-sky-700";
    case "proposal_sent":
      return "bg-blue-50 text-blue-700";
    case "proposal_drafted":
      return "bg-amber-50 text-amber-700";
    case "nurture":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function projectStatusClasses(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "active":
      return "bg-sky-50 text-sky-700";
    case "on_hold":
      return "bg-amber-50 text-amber-700";
    case "cancelled":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function taskStatusClasses(status: string) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700";
    case "in_progress":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function proposalStatusClasses(status: string) {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "sent":
      return "bg-sky-50 text-sky-700";
    case "lost":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function clientStatusClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "paused":
      return "bg-amber-50 text-amber-700";
    case "churned":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function reportStatusClasses(status: string) {
  switch (status) {
    case "ready":
      return "bg-sky-50 text-sky-700";
    case "sent":
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function formatOptionalDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : "NA";
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "NA";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function TableCard({
  title,
  actions,
  children,
}: Readonly<{
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="glass-panel rounded-[32px] p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function buildWorkspaceHref(
  params: {
    tab?: string | null;
    sheet?: string | null;
    q?: string | null;
    view?: string | null;
    leadId?: string | null;
  },
) {
  const search = new URLSearchParams();

  if (params.tab) search.set("tab", params.tab);
  if (params.sheet) search.set("sheet", params.sheet);
  if (params.q) search.set("q", params.q);
  if (params.view) search.set("view", params.view);
  if (params.leadId) search.set("leadId", params.leadId);

  const value = search.toString();
  return value ? `/workspace?${value}` : "/workspace";
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const snapshot = await getOutreachSnapshot();
  const params = (searchParams ? await searchParams : undefined) ?? {};
  const requestedTab = readSearchParam(params.tab);
  const activeTab: WorkspaceTab = workspaceTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as WorkspaceTab)
    : "pipeline";
  const requestedSheet = readSearchParam(params.sheet);
  const query = readSearchParam(params.q)?.trim() ?? "";
  const savedView = readSearchParam(params.view);
  const selectedLeadId = readSearchParam(params.leadId);

  const sheets = buildWorkspaceSheets(snapshot);
  const activeSheet = sheets.find((sheet) => sheet.key === requestedSheet) ?? null;
  const activeSearchRunIds = new Set(activeSheet?.searchRunIds ?? []);
  const companyRecords = buildWorkspaceCompanyRecords(snapshot, {
    sheetKey: activeSheet?.key ?? null,
    query,
    savedView,
  });
  const kpis = getWorkspaceKpis(companyRecords, snapshot);
  const selectedRecord =
    (selectedLeadId
      ? companyRecords.find((record) => record.lead.id === selectedLeadId)
      : null) ?? companyRecords[0] ?? null;
  const returnPath = buildWorkspaceHref({
    tab: activeTab,
    sheet: activeSheet?.key ?? null,
    q: query || null,
    view: savedView,
    leadId: selectedRecord?.lead.id ?? null,
  });

  const leads = activeSheet
    ? snapshot.leads.filter(
        (lead) => lead.niche === activeSheet.niche && lead.locationLabel === activeSheet.location,
      )
    : snapshot.leads;
  const leadIds = new Set(leads.map((lead) => lead.id));
  const contacts = snapshot.contacts.filter((contact) => leadIds.has(contact.leadId));
  const runs = activeSheet
    ? snapshot.runs.filter((run) => {
        if (run.kind === "lead-search") {
          return activeSearchRunIds.has(run.id);
        }

        const scope = run.input.scope === "all-pending" ? "all-pending" : "run";
        const sourceRunId = isNonEmptyString(run.input.sourceRunId)
          ? run.input.sourceRunId.trim()
          : null;

        return scope === "run" && sourceRunId ? activeSearchRunIds.has(sourceRunId) : false;
      })
    : snapshot.runs;
  const campaigns = snapshot.campaigns
    .filter((campaign) => {
      if (!activeSheet) {
        return true;
      }

      if (campaign.sheetKey === activeSheet.key) {
        return true;
      }

      return companyRecords.some((record) => record.campaign?.id === campaign.id);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const companyLeadIds = new Set(companyRecords.map((record) => record.lead.id));
  const visibleClientIds = new Set(
    companyRecords.flatMap((record) => (record.client ? [record.client.id] : [])),
  );
  const opportunities = snapshot.opportunities
    .filter((opportunity) => companyLeadIds.has(opportunity.leadId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const proposals = snapshot.proposalDocuments
    .filter((proposal) => companyLeadIds.has(proposal.leadId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const clients = snapshot.clients
    .filter((client) => companyLeadIds.has(client.leadId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projects = snapshot.clientProjects
    .filter((project) => visibleClientIds.has(project.clientId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const reports = snapshot.monthlyReports
    .filter((report) => visibleClientIds.has(report.clientId))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const reportingConnections = snapshot.reportingConnections.filter((connection) =>
    visibleClientIds.has(connection.clientId),
  );
  const leadMap = new Map(snapshot.leads.map((lead) => [lead.id, lead]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const projectTaskMap = new Map(
    projects.map((project) => [
      project.id,
      snapshot.projectTasks
        .filter((task) => task.projectId === project.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    ]),
  );
  const assetRequestMap = new Map(
    clients.map((client) => [
      client.id,
      snapshot.clientAssetRequests
        .filter((request) => request.clientId === client.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ]),
  );
  const threads = snapshot.emailThreads
    .filter((thread) => companyRecords.some((record) => record.lead.id === thread.leadId))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const campaignMetrics = snapshot.campaignMetrics.filter((metric) =>
    campaigns.some((campaign) => campaign.id === metric.campaignId),
  );
  const pipelineGroups = groupWorkspacePipeline(companyRecords);
  const deleteSheetWithKey = activeSheet ? deleteSheetAction.bind(null, activeSheet.key) : null;
  const savedViews = [
    { id: null, label: "All" },
    { id: "needs_approval", label: "Needs approval" },
    { id: "ready_to_send", label: "Ready to send" },
    { id: "replied_today", label: "Replied today" },
    { id: "no_contact_found", label: "No contact found" },
    { id: "booked", label: "Booked" },
    { id: "needs_escalation", label: "Needs escalation" },
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-6 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-6">
      <section className="glass-panel rounded-[36px] px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              Back
            </Link>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Workspace</p>
            <p className="text-lg font-semibold text-slate-950">
              {activeSheet ? activeSheet.label : "CRM-first outreach hub"}
            </p>
          </div>

          <form method="get" className="hidden flex-wrap items-center gap-3 lg:flex">
            {activeSheet ? <input type="hidden" name="sheet" value={activeSheet.key} /> : null}
            <input type="hidden" name="tab" value={activeTab} />
            {savedView ? <input type="hidden" name="view" value={savedView} /> : null}
            <input
              name="q"
              defaultValue={query}
              placeholder="Search company, contact, website, campaign..."
              className="w-[320px] max-w-full rounded-full border border-line bg-white/80 px-4 py-2.5 text-sm outline-none transition focus:border-slate-950"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Search
            </button>
          </form>

          <div className="hidden flex-wrap items-center gap-3 lg:flex">
            <Link
              href="/documents"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              Documents
            </Link>
            <QuickAddCompanyModal returnPath={returnPath} />
            <QuickAddContactModal leads={leads} returnPath={returnPath} />
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <QuickAddCompanyModal
              returnPath={returnPath}
              triggerClassName="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            />
            <QuickAddContactModal
              leads={leads}
              returnPath={returnPath}
              triggerClassName="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-white"
            />
            <MobileDrawer title="Workspace controls">
              <form method="get" className="space-y-4">
                {activeSheet ? <input type="hidden" name="sheet" value={activeSheet.key} /> : null}
                <input type="hidden" name="tab" value={activeTab} />
                {savedView ? <input type="hidden" name="view" value={savedView} /> : null}
                <div>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Search</span>
                    <input
                      name="q"
                      defaultValue={query}
                      placeholder="Search company, contact, website, campaign..."
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Apply search
                </button>

                <div className="space-y-3 border-t border-line pt-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildWorkspaceHref({ tab: activeTab, q: query || null, view: savedView })}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        !activeSheet
                          ? "bg-slate-950 text-white"
                          : "border border-line bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      All sources
                    </Link>
                    {sheets.map((sheet) => (
                      <Link
                        key={sheet.key}
                        href={buildWorkspaceHref({
                          tab: activeTab,
                          sheet: sheet.key,
                          q: query || null,
                          view: savedView,
                        })}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                          activeSheet?.key === sheet.key
                            ? "bg-slate-950 text-white"
                            : "border border-line bg-white text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {sheet.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-line pt-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {workspaceTabs.map((tab) => (
                      <Link
                        key={tab.id}
                        href={buildWorkspaceHref({
                          tab: tab.id,
                          sheet: activeSheet?.key ?? null,
                          q: query || null,
                          view: savedView,
                          leadId: selectedRecord?.lead.id ?? null,
                        })}
                        className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                          activeTab === tab.id
                            ? "bg-slate-950 text-white"
                            : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-line pt-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Saved views</p>
                  <div className="flex flex-wrap gap-2">
                    {savedViews.map((view) => {
                      const active = (savedView ?? null) === view.id;
                      return (
                        <Link
                          key={view.label}
                          href={buildWorkspaceHref({
                            tab: activeTab,
                            sheet: activeSheet?.key ?? null,
                            q: query || null,
                            view: view.id,
                            leadId: selectedRecord?.lead.id ?? null,
                          })}
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition ${
                            active
                              ? "bg-slate-950 text-white"
                              : "border border-line bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {view.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </form>
            </MobileDrawer>
          </div>
        </div>

        <div className="mt-5 hidden flex-wrap items-center gap-3 lg:flex">
          <Link
            href={buildWorkspaceHref({ tab: activeTab, q: query || null, view: savedView })}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              !activeSheet
                ? "bg-slate-950 text-white"
                : "border border-line bg-white/80 text-slate-800 hover:bg-white"
            }`}
          >
            All sources
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{snapshot.leads.length}</span>
          </Link>

          {sheets.map((sheet) => (
            <Link
              key={sheet.key}
              href={buildWorkspaceHref({
                tab: activeTab,
                sheet: sheet.key,
                q: query || null,
                view: savedView,
              })}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeSheet?.key === sheet.key
                  ? "bg-slate-950 text-white"
                  : "border border-line bg-white/80 text-slate-800 hover:bg-white"
              }`}
            >
              <span>{sheet.label}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{sheet.leadCount}</span>
            </Link>
          ))}
        </div>

        <div className="mt-5 hidden flex-wrap items-center gap-3 lg:flex">
          {workspaceTabs.map((tab) => (
            <Link
              key={tab.id}
              href={buildWorkspaceHref({
                tab: tab.id,
                sheet: activeSheet?.key ?? null,
                q: query || null,
                view: savedView,
                leadId: selectedRecord?.lead.id ?? null,
              })}
              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-slate-950 text-white"
                  : "border border-line bg-white/80 text-slate-700 hover:bg-white"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 hidden flex-wrap items-center gap-3 text-sm lg:flex">
          {savedViews.map((view) => {
            const active = (savedView ?? null) === view.id;
            return (
              <Link
                key={view.label}
                href={buildWorkspaceHref({
                  tab: activeTab,
                  sheet: activeSheet?.key ?? null,
                  q: query || null,
                  view: view.id,
                  leadId: selectedRecord?.lead.id ?? null,
                })}
                className={`inline-flex items-center rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-slate-200 text-slate-950"
                    : "bg-white/70 text-slate-600 hover:bg-white"
                }`}
              >
                {view.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Companies</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.companyCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Contacts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.contactCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Campaigns</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.campaignCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Replies</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.repliedCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Booked</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.bookedCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Needs attention</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.needsAttentionCount}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Opportunities</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.openOpportunities}</p>
          </div>
          <div className="rounded-[22px] border border-line bg-white/75 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Clients</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{kpis.activeClients}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          {activeTab === "pipeline" ? (
            <section className="glass-panel rounded-[32px] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Pipeline</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Outreach lifecycle by company</h2>
                </div>
              </div>

              <div className="scroll-slim mt-6 overflow-x-auto">
                <div className="flex min-w-max gap-4">
                  {pipelineGroups.map((group) => (
                    <section key={group.stage} className="w-[260px] rounded-[24px] border border-line bg-white/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-950">{group.label}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {group.records.length}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {group.records.length ? (
                        group.records.map((record) => (
                          <Link
                            key={record.lead.id}
                            href={buildWorkspaceHref({
                              tab: activeTab,
                              sheet: activeSheet?.key ?? null,
                              q: query || null,
                              view: savedView,
                              leadId: record.lead.id,
                            })}
                            className={`block rounded-[20px] border px-3 py-3 transition ${
                              selectedRecord?.lead.id === record.lead.id
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-line bg-white hover:bg-slate-50"
                            }`}
                          >
                            <p className={`text-sm font-medium ${selectedRecord?.lead.id === record.lead.id ? "text-white" : "text-slate-950"}`}>
                              {record.lead.companyName}
                            </p>
                            <p className={`mt-1 text-xs ${selectedRecord?.lead.id === record.lead.id ? "text-white/75" : "text-slate-500"}`}>
                              {record.serviceAngle ? formatServiceLabel(record.serviceAngle) : "No service"}
                              {" · "}
                              {record.contacts.length} contacts
                            </p>
                            {record.nextStepLabel ? (
                              <p className={`mt-2 text-xs ${selectedRecord?.lead.id === record.lead.id ? "text-white/80" : "text-slate-700"}`}>
                                {record.nextStepLabel}
                              </p>
                            ) : null}
                          </Link>
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line px-3 py-8 text-center text-xs text-slate-500">
                          Empty
                        </div>
                      )}
                    </div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "companies" ? (
            <TableCard
              title="Companies"
              actions={<QuickAddCompanyModal returnPath={returnPath} />}
            >
              <form action={bulkUpdateLeadCrmAction} className="mb-5 flex flex-wrap items-end gap-3 rounded-[24px] border border-line bg-white/75 p-4">
                <input type="hidden" name="returnPath" value={returnPath} />
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Bulk action</span>
                  <select
                    name="action"
                    defaultValue="set_priority"
                    className="min-w-[180px] rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                  >
                    <option value="set_priority">Set priority</option>
                    <option value="set_next_action">Set next action</option>
                    <option value="archive">Archive selected</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Priority</span>
                  <select
                    name="priority"
                    defaultValue="medium"
                    className="min-w-[160px] rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Next action</span>
                  <select
                    name="nextAction"
                    defaultValue=""
                    className="min-w-[200px] rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950"
                  >
                    <option value="">None</option>
                    <option value="review_audit">Review audit</option>
                    <option value="approve_sequence">Approve sequence</option>
                    <option value="send_now">Send now</option>
                    <option value="reply">Reply</option>
                    <option value="book_meeting">Book meeting</option>
                    <option value="follow_up_later">Follow up later</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Apply to selected
                </button>

                <p className="text-sm text-slate-500">
                  Tick company rows below, then apply one bulk action.
                </p>

              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1300px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Pick</th>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Campaign</th>
                      <th className="px-4 py-3 font-medium">Contacts</th>
                      <th className="px-4 py-3 font-medium">Website</th>
                      <th className="px-4 py-3 font-medium">Latest touch</th>
                      <th className="px-4 py-3 font-medium">Next action</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyRecords.length ? (
                      companyRecords.map((record) => (
                        <tr key={record.lead.id} className="border-t border-line align-top">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              name="leadIds"
                              value={record.lead.id}
                              className="h-4 w-4 rounded border-line"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={buildWorkspaceHref({
                                tab: activeTab,
                                sheet: activeSheet?.key ?? null,
                                q: query || null,
                                view: savedView,
                                leadId: record.lead.id,
                              })}
                              className="font-medium text-slate-950 underline decoration-dotted"
                            >
                              {record.lead.companyName}
                            </Link>
                            <div className="mt-1 text-xs text-slate-500">
                              {record.lead.niche} · {record.lead.locationLabel}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getWorkspaceStageClasses(record.stage)}`}>
                              {formatWorkspaceStageLabel(record.stage)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.serviceAngle ? formatServiceLabel(record.serviceAngle) : "NA"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.campaign ? (
                              <Link href={`/outreach/campaign/${record.campaign.id}/overview`} className="underline decoration-dotted">
                                {record.campaign.name}
                              </Link>
                            ) : (
                              "No campaign"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{record.contacts.length}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.lead.websiteUri ? (
                              <a href={record.lead.websiteUri} className="break-all underline decoration-dotted">
                                {record.lead.websiteUri}
                              </a>
                            ) : (
                              "NA"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{formatDateTime(record.latestActivityAt)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.crm?.nextAction ? formatNextActionLabel(record.crm.nextAction) : record.nextStepLabel ?? "None"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.crm ? formatPriorityLabel(record.crm.priority) : "Medium"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-600">
                          No companies match this view yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </form>
            </TableCard>
          ) : null}

          {activeTab === "contacts" ? (
            <TableCard
              title="Contacts"
              actions={<QuickAddContactModal leads={leads} returnPath={returnPath} />}
            >
              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1200px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Confidence</th>
                      <th className="px-4 py-3 font-medium">Preferred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyRecords.flatMap((record) =>
                      record.contacts.map((contact) => ({ record, contact })),
                    ).length ? (
                      companyRecords.flatMap((record) =>
                        record.contacts.map((contact) => ({ record, contact })),
                      ).map(({ record, contact }) => (
                        <tr key={contact.id} className="border-t border-line align-top">
                          <td className="px-4 py-3 text-slate-950">{record.lead.companyName}</td>
                          <td className="px-4 py-3 text-slate-950">{contact.name}</td>
                          <td className="px-4 py-3 text-slate-700">{contact.title ?? "NA"}</td>
                          <td className="px-4 py-3 text-slate-700">{contact.email ?? "NA"}</td>
                          <td className="px-4 py-3 text-slate-700">{contact.confidence}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {record.preferredContact?.id === contact.id ? "Yes" : ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                          No contacts in this view yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "campaigns" ? (
            <TableCard title="Campaigns">
              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1380px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Campaign</th>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Mailbox</th>
                      <th className="px-4 py-3 font-medium">Leads</th>
                      <th className="px-4 py-3 font-medium">Approved</th>
                      <th className="px-4 py-3 font-medium">Scheduled</th>
                      <th className="px-4 py-3 font-medium">Sent</th>
                      <th className="px-4 py-3 font-medium">Replied</th>
                      <th className="px-4 py-3 font-medium">Booked</th>
                      <th className="px-4 py-3 font-medium">Nurture</th>
                      <th className="px-4 py-3 font-medium">Closed</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length ? (
                      campaigns.map((campaign) => {
                        const metrics = campaignMetrics.find((metric) => metric.campaignId === campaign.id);
                        const mailbox = snapshot.connectedMailboxes.find((item) => item.id === campaign.mailboxId);

                        return (
                          <tr key={campaign.id} className="border-t border-line align-top">
                            <td className="px-4 py-3">
                              <Link href={`/outreach/campaign/${campaign.id}/overview`} className="font-medium text-slate-950 underline decoration-dotted">
                                {campaign.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatServiceLabel(campaign.serviceKey)}</td>
                            <td className="px-4 py-3 text-slate-700">{mailbox?.email ?? "No mailbox"}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.leadCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.approvedCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.scheduledCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.sentCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.repliedCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.bookedCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.nurtureCount ?? 0}</td>
                            <td className="px-4 py-3 text-slate-700">{metrics?.closedCount ?? 0}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${getCampaignStatusClasses(campaign.status)}`}>
                                {campaign.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-slate-600">
                          No campaigns for this source yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "inbox" ? (
            <TableCard title="Inbox">
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-line bg-white/75 p-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Thread list</p>
                  <div className="mt-4 space-y-3">
                    {threads.length ? (
                      threads.slice(0, 18).map((thread) => (
                        <Link
                          key={thread.id}
                          href={buildWorkspaceHref({
                            tab: activeTab,
                            sheet: activeSheet?.key ?? null,
                            q: query || null,
                            view: savedView,
                            leadId: thread.leadId ?? null,
                          })}
                          className="block rounded-[20px] border border-line bg-white px-4 py-3 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-950">{thread.subject}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getOutreachStateClasses(thread.state)}`}>
                              {thread.state.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {thread.contactName ?? thread.contactEmail ?? "Unknown contact"}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(thread.lastMessageAt)}</p>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-line px-4 py-10 text-center text-sm text-slate-500">
                        No inbox threads in this view yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-line bg-white/75 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-500">CRM inbox view</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Filtered to the current source. Open the full operator inbox for deeper reply handling.
                      </p>
                    </div>
                    <Link
                      href="/outreach/inbox"
                      className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
                    >
                      Open full Inbox
                    </Link>
                  </div>
                </div>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "sales" ? (
            <TableCard title="Sales">
              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1260px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Probability</th>
                      <th className="px-4 py-3 font-medium">Next step</th>
                      <th className="px-4 py-3 font-medium">Due</th>
                      <th className="px-4 py-3 font-medium">Last touch</th>
                      <th className="px-4 py-3 font-medium">Proposal</th>
                      <th className="px-4 py-3 font-medium">Meeting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.length ? (
                      opportunities.map((opportunity) => {
                        const record = companyRecords.find((candidate) => candidate.lead.id === opportunity.leadId) ?? null;
                        const proposal =
                          proposals.find((candidate) => candidate.opportunityId === opportunity.id) ?? null;
                        const meeting =
                          snapshot.meetings
                            .filter((candidate) => candidate.opportunityId === opportunity.id)
                            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0] ?? null;

                        return (
                          <tr key={opportunity.id} className="border-t border-line align-top">
                            <td className="px-4 py-3">
                              <Link
                                href={buildWorkspaceHref({
                                  tab: activeTab,
                                  sheet: activeSheet?.key ?? null,
                                  q: query || null,
                                  view: savedView,
                                  leadId: opportunity.leadId,
                                })}
                                className="font-medium text-slate-950 underline decoration-dotted"
                              >
                                {record?.lead.companyName ?? leadMap.get(opportunity.leadId)?.companyName ?? "Unknown"}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatServiceLabel(opportunity.serviceKey)}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${opportunityStageClasses(opportunity.stage)}`}>
                                {opportunity.stage.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatCurrency(opportunity.estimatedValueUsd)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {typeof opportunity.closeProbability === "number"
                                ? `${opportunity.closeProbability}%`
                                : "NA"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{opportunity.nextStep ?? "NA"}</td>
                            <td className="px-4 py-3 text-slate-700">{formatOptionalDateTime(opportunity.nextStepDueAt)}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(opportunity.lastTouchAt)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {proposal ? (
                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${proposalStatusClasses(proposal.status)}`}>
                                  {proposal.status}
                                </span>
                              ) : (
                                "No proposal"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {meeting ? `${meeting.status.replace(/_/g, " ")} · ${formatDateTime(meeting.scheduledAt)}` : "Not booked"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-600">
                          No opportunities in this source yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "proposals" ? (
            <TableCard title="Proposals">
              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1220px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.length ? (
                      proposals.map((proposal) => {
                        const lead = leadMap.get(proposal.leadId);
                        return (
                          <tr key={proposal.id} className="border-t border-line align-top">
                            <td className="px-4 py-3 text-slate-950">{lead?.companyName ?? "Unknown"}</td>
                            <td className="px-4 py-3 text-slate-700">{formatServiceLabel(proposal.serviceKey)}</td>
                            <td className="px-4 py-3 text-slate-700">{formatCurrency(proposal.amountUsd)}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${proposalStatusClasses(proposal.status)}`}>
                                {proposal.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {proposal.docUrl ? (
                                <a href={proposal.docUrl} className="underline decoration-dotted">
                                  Open Doc
                                </a>
                              ) : (
                                "In app only"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(proposal.updatedAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {proposal.status !== "sent" ? (
                                  <form action={updateProposalStatusAction}>
                                    <input type="hidden" name="proposalId" value={proposal.id} />
                                    <input type="hidden" name="status" value="sent" />
                                    <input type="hidden" name="returnPath" value={returnPath} />
                                    <button
                                      type="submit"
                                      className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    >
                                      Mark sent
                                    </button>
                                  </form>
                                ) : null}
                                {proposal.status !== "accepted" ? (
                                  <form action={updateProposalStatusAction}>
                                    <input type="hidden" name="proposalId" value={proposal.id} />
                                    <input type="hidden" name="status" value="accepted" />
                                    <input type="hidden" name="returnPath" value={returnPath} />
                                    <button
                                      type="submit"
                                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                                    >
                                      Accept
                                    </button>
                                  </form>
                                ) : null}
                                {proposal.status !== "lost" ? (
                                  <form action={updateProposalStatusAction}>
                                    <input type="hidden" name="proposalId" value={proposal.id} />
                                    <input type="hidden" name="status" value="lost" />
                                    <input type="hidden" name="returnPath" value={returnPath} />
                                    <button
                                      type="submit"
                                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                                    >
                                      Mark lost
                                    </button>
                                  </form>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                          No proposals in this source yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "clients" ? (
            <TableCard title="Clients">
              <div className="grid gap-4 lg:grid-cols-2">
                {clients.length ? (
                  clients.map((client) => {
                    const lead = leadMap.get(client.leadId);
                    const clientProjects = projects.filter((project) => project.clientId === client.id);
                    const clientReports = reports.filter((report) => report.clientId === client.id);
                    const clientAssetsRequested = assetRequestMap.get(client.id) ?? [];

                    return (
                      <article key={client.id} className="rounded-[24px] border border-line bg-white/80 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Client</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">{lead?.companyName ?? "Unknown"}</h3>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${clientStatusClasses(client.status)}`}>
                            {client.status}
                          </span>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Retainer</dt>
                            <dd className="mt-1 text-slate-900">{client.retainerType.replace(/_/g, " ")}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Billing cycle</dt>
                            <dd className="mt-1 text-slate-900">{client.billingCycle ?? "NA"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Projects</dt>
                            <dd className="mt-1 text-slate-900">{clientProjects.length}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Reports</dt>
                            <dd className="mt-1 text-slate-900">{clientReports.length}</dd>
                          </div>
                        </dl>
                        {clientAssetsRequested.length ? (
                          <div className="mt-4 rounded-[18px] border border-line bg-white p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Asset requests</p>
                            <div className="mt-2 space-y-2">
                              {clientAssetsRequested.slice(0, 3).map((request) => (
                                <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-slate-900">{request.type}</span>
                                  <span className="text-slate-500">{request.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-line bg-white/70 px-4 py-10 text-center text-slate-600 lg:col-span-2">
                    No clients converted yet.
                  </div>
                )}
              </div>
            </TableCard>
          ) : null}

          {activeTab === "projects" ? (
            <TableCard title="Projects">
              <div className="grid gap-4 lg:grid-cols-2">
                {projects.length ? (
                  projects.map((project) => {
                    const client = clientMap.get(project.clientId);
                    const lead = client ? leadMap.get(client.leadId) : null;
                    const tasks = projectTaskMap.get(project.id) ?? [];
                    return (
                      <article key={project.id} className="rounded-[24px] border border-line bg-white/80 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{formatServiceLabel(project.serviceKey)}</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">{project.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{lead?.companyName ?? "Unknown client"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${projectStatusClasses(project.status)}`}>
                            {project.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="mt-4 space-y-2">
                          {tasks.length ? (
                            tasks.slice(0, 5).map((task) => (
                              <div key={task.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-line bg-white px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-950">{task.title}</p>
                                  <p className="text-xs text-slate-500">{formatOptionalDateTime(task.dueAt)}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${taskStatusClasses(task.status)}`}>
                                  {task.status.replace(/_/g, " ")}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-600">No tasks yet.</p>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-line bg-white/70 px-4 py-10 text-center text-slate-600 lg:col-span-2">
                    No delivery projects exist yet.
                  </div>
                )}
              </div>
            </TableCard>
          ) : null}

          {activeTab === "reports" ? (
            <TableCard title="Reports">
              <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                <table className="min-w-[1180px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Sources</th>
                      <th className="px-4 py-3 font-medium">Summary</th>
                      <th className="px-4 py-3 font-medium">Doc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length ? (
                      reports.map((report) => {
                        const client = clientMap.get(report.clientId);
                        const lead = client ? leadMap.get(client.leadId) : null;
                        const sourceCount = reportingConnections.filter((connection) => connection.clientId === report.clientId).length;
                        return (
                          <tr key={report.id} className="border-t border-line align-top">
                            <td className="px-4 py-3 text-slate-950">{lead?.companyName ?? "Unknown"}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {report.periodStart} → {report.periodEnd}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${reportStatusClasses(report.status)}`}>
                                {report.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{sourceCount}</td>
                            <td className="px-4 py-3 text-slate-700">{report.summary}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {report.docUrl ? (
                                <a href={report.docUrl} className="underline decoration-dotted">
                                  Open Doc
                                </a>
                              ) : (
                                "In app only"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                          No monthly reports drafted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          ) : null}

          {activeTab === "data" ? (
            <>
              <section className="glass-panel rounded-[32px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-muted">Source Settings</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Rename, export, or remove the current source while keeping CRM views above clean.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`${activeSheet ? `/api/workspace/export?sheet=${encodeURIComponent(activeSheet.key)}` : "/api/workspace/export"}&type=leads`}
                      className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
                    >
                      Export Leads CSV
                    </a>
                    <a
                      href={`${activeSheet ? `/api/workspace/export?sheet=${encodeURIComponent(activeSheet.key)}` : "/api/workspace/export"}&type=contacts`}
                      className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
                    >
                      Export Contacts CSV
                    </a>
                  </div>
                </div>

                {activeSheet ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <form action={renameSheetAction} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="sheetKey" value={activeSheet.key} />
                      <label className="min-w-[280px] flex-1 space-y-2">
                        <span className="text-sm font-medium text-slate-700">Source name</span>
                        <input
                          name="sheetLabel"
                          defaultValue={activeSheet.label}
                          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Save Source Name
                      </button>
                    </form>

                    {deleteSheetWithKey ? (
                      <form action={deleteSheetWithKey}>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          Delete Source
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <TableCard title="Leads Table">
                <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                  <table className="min-w-[1200px] w-full text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 font-medium">Company</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Niche</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Website</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Contacts</th>
                        <th className="px-4 py-3 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length ? (
                        leads.map((lead) => (
                          <tr key={lead.id} className="border-t border-line align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-950">{lead.companyName}</div>
                              <div className="mt-1 text-xs text-slate-500">{lead.address}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(lead.stage)}`}>
                                {lead.stage}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{lead.niche}</td>
                            <td className="px-4 py-3 text-slate-700">{lead.locationLabel}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {lead.websiteUri ? (
                                <a href={lead.websiteUri} className="break-all underline decoration-dotted">
                                  {lead.websiteUri}
                                </a>
                              ) : (
                                "NA"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {lead.internationalPhoneNumber ?? lead.nationalPhoneNumber ?? "NA"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{lead.contactCount}</td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(lead.updatedAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-slate-600">
                            No leads are saved in this source yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TableCard>

              <TableCard title="Contacts Table">
                <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                  <table className="min-w-[1300px] w-full text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 font-medium">Lead</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">LinkedIn</th>
                        <th className="px-4 py-3 font-medium">Confidence</th>
                        <th className="px-4 py-3 font-medium">Found</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.length ? (
                        contacts.map((contact) => {
                          const lead = leads.find((item) => item.id === contact.leadId);
                          return (
                            <tr key={contact.id} className="border-t border-line align-top">
                              <td className="px-4 py-3 text-slate-950">{lead?.companyName ?? "Unknown"}</td>
                              <td className="px-4 py-3 text-slate-950">{contact.name}</td>
                              <td className="px-4 py-3 text-slate-700">{contact.title ?? "NA"}</td>
                              <td className="px-4 py-3 text-slate-700">{contact.email ?? "NA"}</td>
                              <td className="px-4 py-3 text-slate-700">{contact.linkedin ?? "NA"}</td>
                              <td className="px-4 py-3 text-slate-700">{contact.confidence}</td>
                              <td className="px-4 py-3 text-slate-700">{formatDateTime(contact.discoveredAt)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                            No contacts are saved in this source yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TableCard>

              <TableCard title="Runs Table">
                <div className="scroll-slim overflow-x-auto rounded-[24px] border border-line bg-white/70">
                  <table className="min-w-[1200px] w-full text-left text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 font-medium">Kind</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Started</th>
                        <th className="px-4 py-3 font-medium">Summary</th>
                        <th className="px-4 py-3 font-medium">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.length ? (
                        runs.map((run) => (
                          <tr key={run.id} className="border-t border-line align-top">
                            <td className="px-4 py-3 text-slate-950">{run.kind}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(run.status)}`}>
                                {run.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(run.startedAt)}</td>
                            <td className="px-4 py-3 text-slate-700">{run.summary ?? "NA"}</td>
                            <td className="px-4 py-3">
                              <form action={deleteRunAction.bind(null, run.id)}>
                                <button
                                  type="submit"
                                  className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  Delete
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                            No runs in this source yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            </>
          ) : null}
        </div>

        <aside className="space-y-6">
          {selectedRecord ? (
            <section className="glass-panel rounded-[32px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Company detail</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedRecord.lead.companyName}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedRecord.lead.niche} · {selectedRecord.lead.locationLabel}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${getWorkspaceStageClasses(selectedRecord.stage)}`}>
                  {formatWorkspaceStageLabel(selectedRecord.stage)}
                </span>
              </div>

              <div className="mt-5 space-y-5">
                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Overview</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Website</dt>
                      <dd className="max-w-[220px] text-right text-slate-900">
                        {selectedRecord.lead.websiteUri ? (
                          <a href={selectedRecord.lead.websiteUri} className="break-all underline decoration-dotted">
                            {selectedRecord.lead.websiteUri}
                          </a>
                        ) : (
                          "NA"
                        )}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Phone</dt>
                      <dd className="text-right text-slate-900">
                        {selectedRecord.lead.internationalPhoneNumber ??
                          selectedRecord.lead.nationalPhoneNumber ??
                          "NA"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Campaign</dt>
                      <dd className="text-right text-slate-900">
                        {selectedRecord.campaign ? (
                          <Link href={`/outreach/campaign/${selectedRecord.campaign.id}/overview`} className="underline decoration-dotted">
                            {selectedRecord.campaign.name}
                          </Link>
                        ) : (
                          "No campaign"
                        )}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">Service</dt>
                      <dd className="text-right text-slate-900">
                        {selectedRecord.serviceAngle ? formatServiceLabel(selectedRecord.serviceAngle) : "NA"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contacts</p>
                  <div className="mt-3 space-y-3">
                    {selectedRecord.contacts.length ? (
                      selectedRecord.contacts.map((contact) => (
                        <div key={contact.id} className="rounded-[18px] border border-line bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-950">{contact.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{contact.title ?? "No title"}</p>
                            </div>
                            {selectedRecord.preferredContact?.id === contact.id ? (
                              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-medium text-white">
                                Preferred
                              </span>
                            ) : null}
                          </div>
                          {contact.email ? <p className="mt-2 text-xs text-slate-700">{contact.email}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No researched contacts yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Audit</p>
                  {selectedRecord.latestFinding ? (
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-950">{selectedRecord.latestFinding.summary}</p>
                      <p>{selectedRecord.latestFinding.recognizableReason}</p>
                      <p>{selectedRecord.latestFinding.consequenceMechanics}</p>
                      <p className="text-xs text-slate-500">
                        {selectedRecord.latestFinding.pageLabel ?? selectedRecord.latestFinding.pageUrl ?? "Homepage"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">No audit finding yet.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sequences</p>
                  {selectedRecord.sequence ? (
                    <div className="mt-3 space-y-3">
                      {selectedRecord.sequence.steps.map((step) => (
                        <div key={step.stepNumber} className="rounded-[18px] border border-line bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-950">
                              Day {step.dayOffset + 1} · Step {step.stepNumber}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {step.sendState}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{step.subject}</p>
                        </div>
                      ))}
                      {selectedRecord.sequence.steps.find((step) => step.sendState !== "sent") ? (
                        <SequenceStepEditor
                          sequenceId={selectedRecord.sequence.id}
                          stepNumber={
                            selectedRecord.sequence.steps.find((step) => step.sendState !== "sent")
                              ?.stepNumber ?? 1
                          }
                          initialSubject={
                            selectedRecord.sequence.steps.find((step) => step.sendState !== "sent")
                              ?.subject ?? selectedRecord.sequence.steps[0]?.subject ?? ""
                          }
                          initialBody={
                            selectedRecord.sequence.steps.find((step) => step.sendState !== "sent")
                              ?.body ?? selectedRecord.sequence.steps[0]?.body ?? ""
                          }
                          isSent={false}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">No generated sequence yet.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sales</p>
                    {selectedRecord.opportunity ? (
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${opportunityStageClasses(selectedRecord.opportunity.stage)}`}>
                        {selectedRecord.opportunity.stage.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>

                  <form action={createOpportunityAction} className="mt-3 space-y-3">
                    <input type="hidden" name="leadId" value={selectedRecord.lead.id} />
                    <input type="hidden" name="contactId" value={selectedRecord.preferredContact?.id ?? ""} />
                    <input type="hidden" name="sourceCampaignId" value={selectedRecord.campaign?.id ?? ""} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Service</span>
                        <select
                          name="serviceKey"
                          defaultValue={selectedRecord.opportunity?.serviceKey ?? selectedRecord.serviceAngle ?? "seo"}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        >
                          <option value="seo">SEO</option>
                          <option value="webdesign">Webdesign</option>
                          <option value="copywriting">Copywriting</option>
                          <option value="ai_automation">AI Automation</option>
                          <option value="marketing">Marketing</option>
                          <option value="lead_capture">Lead Capture</option>
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Value</span>
                        <input
                          type="number"
                          name="estimatedValueUsd"
                          defaultValue={selectedRecord.opportunity?.estimatedValueUsd ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Win %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          name="closeProbability"
                          defaultValue={selectedRecord.opportunity?.closeProbability ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Next step due</span>
                        <input
                          type="datetime-local"
                          name="nextStepDueAt"
                          defaultValue={selectedRecord.opportunity?.nextStepDueAt?.slice(0, 16) ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        />
                      </label>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Next step</span>
                      <input
                        name="nextStep"
                        defaultValue={selectedRecord.opportunity?.nextStep ?? ""}
                        className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Notes</span>
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={selectedRecord.opportunity?.notes ?? ""}
                        className="w-full rounded-[20px] border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      {selectedRecord.opportunity ? "Update opportunity" : "Create opportunity"}
                    </button>
                  </form>

                  {selectedRecord.opportunity ? (
                    <>
                      <form action={updateOpportunityStageAction} className="mt-4 space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="opportunityId" value={selectedRecord.opportunity.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Stage</span>
                            <select
                              name="stage"
                              defaultValue={selectedRecord.opportunity.stage}
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            >
                              <option value="new">New</option>
                              <option value="qualified">Qualified</option>
                              <option value="meeting_booked">Meeting booked</option>
                              <option value="proposal_drafted">Proposal drafted</option>
                              <option value="proposal_sent">Proposal sent</option>
                              <option value="won">Won</option>
                              <option value="lost">Lost</option>
                              <option value="nurture">Nurture</option>
                            </select>
                          </label>
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Status</span>
                            <select
                              name="status"
                              defaultValue={selectedRecord.opportunity.status}
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            >
                              <option value="open">Open</option>
                              <option value="won">Won</option>
                              <option value="lost">Lost</option>
                              <option value="nurture">Nurture</option>
                            </select>
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Save stage
                        </button>
                      </form>

                      <form action={createMeetingAction} className="mt-4 space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="leadId" value={selectedRecord.lead.id} />
                        <input type="hidden" name="opportunityId" value={selectedRecord.opportunity.id} />
                        <input type="hidden" name="contactId" value={selectedRecord.preferredContact?.id ?? ""} />
                        <input type="hidden" name="status" value="planned" />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Meeting time</span>
                            <input
                              type="datetime-local"
                              name="scheduledAt"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                              required
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Duration</span>
                            <input
                              type="number"
                              name="durationMinutes"
                              defaultValue={30}
                              min={5}
                              max={240}
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            />
                          </label>
                        </div>
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-700">Agenda</span>
                          <input
                            name="agenda"
                            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                          />
                        </label>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Book meeting
                        </button>
                      </form>

                      {selectedRecord.meetings.length ? (
                        <div className="mt-4 space-y-2">
                          {selectedRecord.meetings.slice(0, 3).map((meeting) => (
                            <div key={meeting.id} className="rounded-[18px] border border-line bg-white px-3 py-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-950">{formatDateTime(meeting.scheduledAt)}</span>
                                <span className="text-slate-500">{meeting.status.replace(/_/g, " ")}</span>
                              </div>
                              {meeting.agenda ? <p className="mt-2 text-slate-700">{meeting.agenda}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Proposal</p>
                  {selectedRecord.opportunity ? (
                    <div className="mt-3 space-y-3">
                      <form action={generateProposalAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="opportunityId" value={selectedRecord.opportunity.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-700">Proposal amount</span>
                          <input
                            type="number"
                            name="amountUsd"
                            defaultValue={selectedRecord.latestProposal?.amountUsd ?? selectedRecord.opportunity.estimatedValueUsd ?? ""}
                            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                          />
                        </label>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          {selectedRecord.latestProposal ? "Generate fresh proposal" : "Generate proposal"}
                        </button>
                      </form>

                      {selectedRecord.latestProposal ? (
                        <div className="rounded-[20px] border border-line bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-950">{selectedRecord.latestProposal.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatCurrency(selectedRecord.latestProposal.amountUsd)}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${proposalStatusClasses(selectedRecord.latestProposal.status)}`}>
                              {selectedRecord.latestProposal.status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedRecord.latestProposal.docUrl ? (
                              <a
                                href={selectedRecord.latestProposal.docUrl}
                                className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Open Doc
                              </a>
                            ) : null}
                            {selectedRecord.latestProposal.status !== "sent" ? (
                              <form action={updateProposalStatusAction}>
                                <input type="hidden" name="proposalId" value={selectedRecord.latestProposal.id} />
                                <input type="hidden" name="status" value="sent" />
                                <input type="hidden" name="returnPath" value={returnPath} />
                                <button
                                  type="submit"
                                  className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  Mark sent
                                </button>
                              </form>
                            ) : null}
                            {selectedRecord.latestProposal.status !== "accepted" ? (
                              <form action={updateProposalStatusAction}>
                                <input type="hidden" name="proposalId" value={selectedRecord.latestProposal.id} />
                                <input type="hidden" name="status" value="accepted" />
                                <input type="hidden" name="returnPath" value={returnPath} />
                                <button
                                  type="submit"
                                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                                >
                                  Accept
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">Create an opportunity first, then generate a proposal.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client / Projects</p>
                  <div className="mt-3 space-y-3">
                    {selectedRecord.client ? (
                      <>
                        <div className="rounded-[20px] border border-line bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-950">Client active</p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${clientStatusClasses(selectedRecord.client.status)}`}>
                              {selectedRecord.client.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Start {formatOptionalDateTime(selectedRecord.client.startDate)}
                            {selectedRecord.client.billingCycle ? ` · ${selectedRecord.client.billingCycle}` : ""}
                          </p>
                        </div>

                        <form action={createProjectAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                          <input type="hidden" name="clientId" value={selectedRecord.client.id} />
                          <input type="hidden" name="serviceKey" value={selectedRecord.serviceAngle ?? selectedRecord.opportunity?.serviceKey ?? "seo"} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">New project</span>
                            <input
                              name="name"
                              placeholder="Monthly SEO sprint"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                              required
                            />
                          </label>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                          >
                            Add project
                          </button>
                        </form>

                        {selectedRecord.activeProjects.length ? (
                          <div className="space-y-3">
                            {selectedRecord.activeProjects.map((project) => {
                              const tasks = projectTaskMap.get(project.id) ?? [];
                              return (
                                <div key={project.id} className="rounded-[20px] border border-line bg-white p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-slate-950">{project.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{formatServiceLabel(project.serviceKey)}</p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${projectStatusClasses(project.status)}`}>
                                      {project.status}
                                    </span>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {tasks.slice(0, 4).map((task) => (
                                      <form key={task.id} action={updateProjectTaskAction} className="flex items-center justify-between gap-3 rounded-[16px] border border-line bg-slate-50 px-3 py-2">
                                        <input type="hidden" name="taskId" value={task.id} />
                                        <input type="hidden" name="title" value={task.title} />
                                        <input type="hidden" name="dueAt" value={task.dueAt ?? ""} />
                                        <input type="hidden" name="notes" value={task.notes ?? ""} />
                                        <input type="hidden" name="returnPath" value={returnPath} />
                                        <div>
                                          <p className="text-sm font-medium text-slate-950">{task.title}</p>
                                          <p className="text-xs text-slate-500">{formatOptionalDateTime(task.dueAt)}</p>
                                        </div>
                                        <select
                                          name="status"
                                          defaultValue={task.status}
                                          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
                                        >
                                          <option value="todo">Todo</option>
                                          <option value="in_progress">In progress</option>
                                          <option value="done">Done</option>
                                        </select>
                                        <button
                                          type="submit"
                                          className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                        >
                                          Save
                                        </button>
                                      </form>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <form action={requestClientAssetAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                          <input type="hidden" name="clientId" value={selectedRecord.client.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                            <input
                              name="type"
                              placeholder="Logo / GA4 access / copy"
                              className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                              required
                            />
                            <input
                              name="description"
                              placeholder="Optional asset request note"
                              className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            />
                          </div>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                          >
                            Request asset
                          </button>
                        </form>
                      </>
                    ) : selectedRecord.opportunity ? (
                      <form action={convertOpportunityToClientAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="opportunityId" value={selectedRecord.opportunity.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Start date</span>
                            <input
                              type="date"
                              name="startDate"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Retainer type</span>
                            <select
                              name="retainerType"
                              defaultValue="project"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            >
                              <option value="project">Project</option>
                              <option value="one_off">One-off</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                            </select>
                          </label>
                        </div>
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-700">Billing cycle</span>
                          <input
                            name="billingCycle"
                            placeholder="Monthly retainer / 50-50 / one time"
                            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                          />
                        </label>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          Convert to client
                        </button>
                      </form>
                    ) : (
                      <p className="text-sm text-slate-600">Win the opportunity first, then convert it into a client and project.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inbox / Activity</p>
                  {selectedRecord.thread ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p className="font-medium text-slate-950">{selectedRecord.thread.subject}</p>
                      <p>{selectedRecord.thread.contactName ?? selectedRecord.thread.contactEmail ?? "Unknown contact"}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(selectedRecord.thread.lastMessageAt)}</p>
                      <Link
                        href="/outreach/inbox"
                        className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Open in Inbox
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">No thread activity yet.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reports</p>
                  {selectedRecord.client ? (
                    <div className="mt-3 space-y-3">
                      <form action={createReportingConnectionAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="clientId" value={selectedRecord.client.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <select
                            name="kind"
                            defaultValue="pagespeed"
                            className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                          >
                            <option value="pagespeed">PageSpeed</option>
                            <option value="search_console">Search Console</option>
                            <option value="ga4">GA4</option>
                          </select>
                          <input
                            name="target"
                            placeholder="URL, siteUrl, or GA4 property id"
                            className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Add reporting source
                        </button>
                      </form>

                      <form action={generateMonthlyReportAction} className="space-y-3 rounded-[20px] border border-line bg-white p-4">
                        <input type="hidden" name="clientId" value={selectedRecord.client.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Period start</span>
                            <input
                              type="date"
                              name="periodStart"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                              required
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">Period end</span>
                            <input
                              type="date"
                              name="periodEnd"
                              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                              required
                            />
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          Generate report
                        </button>
                      </form>

                      {selectedRecord.reports.length ? (
                        <div className="space-y-2">
                          {selectedRecord.reports.slice(0, 3).map((report) => (
                            <div key={report.id} className="rounded-[18px] border border-line bg-white px-3 py-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-slate-950">{report.title}</span>
                                <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${reportStatusClasses(report.status)}`}>
                                  {report.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{report.periodStart} → {report.periodEnd}</p>
                              {report.docUrl ? (
                                <a href={report.docUrl} className="mt-2 inline-flex text-xs font-medium text-slate-700 underline decoration-dotted">
                                  Open report doc
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">Convert this company into a client before adding reporting sources.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tasks / Memory</p>
                  <form action={updateLeadCrmAction} className="mt-3 space-y-3">
                    <input type="hidden" name="leadId" value={selectedRecord.lead.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Notes</span>
                      <textarea
                        name="notes"
                        defaultValue={selectedRecord.crm?.notes ?? ""}
                        rows={4}
                        className="w-full rounded-[20px] border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Priority</span>
                        <select
                          name="priority"
                          defaultValue={selectedRecord.crm?.priority ?? "medium"}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Next action</span>
                        <select
                          name="nextAction"
                          defaultValue={selectedRecord.crm?.nextAction ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        >
                          <option value="">None</option>
                          <option value="review_audit">Review audit</option>
                          <option value="approve_sequence">Approve sequence</option>
                          <option value="send_now">Send now</option>
                          <option value="reply">Reply</option>
                          <option value="book_meeting">Book meeting</option>
                          <option value="follow_up_later">Follow up later</option>
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Due date</span>
                        <input
                          type="datetime-local"
                          name="nextActionDueAt"
                          defaultValue={selectedRecord.crm?.nextActionDueAt?.slice(0, 16) ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Owner label</span>
                        <input
                          name="ownerLabel"
                          defaultValue={selectedRecord.crm?.ownerLabel ?? ""}
                          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="archived"
                        defaultChecked={Boolean(selectedRecord.crm?.archivedAt)}
                        className="h-4 w-4 rounded border-line"
                      />
                      Archive this company from the active workspace
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Save CRM details
                    </button>
                  </form>

                  <form action={createReminderAction} className="mt-4 space-y-3 rounded-[20px] border border-line bg-white p-4">
                    <input type="hidden" name="leadId" value={selectedRecord.lead.id} />
                    <input type="hidden" name="opportunityId" value={selectedRecord.opportunity?.id ?? ""} />
                    <input type="hidden" name="clientId" value={selectedRecord.client?.id ?? ""} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <input
                        name="title"
                        placeholder="Follow up, send proposal, ask for assets..."
                        className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        required
                      />
                      <input
                        type="datetime-local"
                        name="dueAt"
                        className="rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                        required
                      />
                    </div>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Optional reminder notes"
                      className="w-full rounded-[20px] border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                    >
                      Create reminder
                    </button>
                  </form>

                  <form action={addActivityNoteAction} className="mt-4 space-y-3 rounded-[20px] border border-line bg-white p-4">
                    <input type="hidden" name="entityType" value={selectedRecord.client ? "client" : "lead"} />
                    <input type="hidden" name="entityId" value={selectedRecord.client?.id ?? selectedRecord.lead.id} />
                    <input type="hidden" name="leadId" value={selectedRecord.lead.id} />
                    <input type="hidden" name="clientId" value={selectedRecord.client?.id ?? ""} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <textarea
                      name="body"
                      rows={3}
                      placeholder="Add a quick note after a call, reply, or internal review"
                      className="w-full rounded-[20px] border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-950"
                      required
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                    >
                      Add note
                    </button>
                  </form>

                  {(selectedRecord.reminders.length || selectedRecord.activityNotes.length) ? (
                    <div className="mt-4 space-y-3">
                      {selectedRecord.reminders.slice(0, 3).map((reminder) => (
                        <div key={reminder.id} className="rounded-[18px] border border-line bg-white px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-950">{reminder.title}</span>
                            <span className="text-slate-500">{reminder.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(reminder.dueAt)}</p>
                        </div>
                      ))}
                      {selectedRecord.activityNotes.slice(0, 3).map((note) => (
                        <div key={note.id} className="rounded-[18px] border border-line bg-white px-3 py-3 text-sm">
                          <p className="text-slate-900">{note.body}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(note.updatedAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            </section>
          ) : (
            <section className="glass-panel rounded-[32px] p-6">
              <p className="text-sm text-slate-600">Select a company to open the CRM detail panel.</p>
            </section>
          )}
        </aside>
      </div>

      <MobileQuickActionsBar>
        <QuickAddCompanyModal
          returnPath={returnPath}
          triggerClassName="inline-flex flex-1 items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        />
        <QuickAddContactModal
          leads={leads}
          returnPath={returnPath}
          triggerClassName="inline-flex flex-1 items-center justify-center rounded-full border border-line bg-white/85 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
        />
      </MobileQuickActionsBar>
    </main>
  );
}
