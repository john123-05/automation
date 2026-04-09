import type {
  Contact,
  GeneratedSequence,
  LeadCrmMetadata,
  OutreachSnapshot,
  ProspectOutreachState,
  WebsiteAuditFinding,
  WorkspaceCompanyRecord,
  WorkspaceCompanyStage,
} from "@/lib/sales-machine/types";
import { buildWorkspaceSheets, createSheetKey, getDefaultSheetLabel } from "@/lib/sales-machine/workspace-sheets";

export const workspaceTabs = [
  { id: "pipeline", label: "Pipeline" },
  { id: "companies", label: "Companies" },
  { id: "contacts", label: "Contacts" },
  { id: "campaigns", label: "Campaigns" },
  { id: "inbox", label: "Inbox" },
  { id: "sales", label: "Sales" },
  { id: "proposals", label: "Proposals" },
  { id: "clients", label: "Clients" },
  { id: "projects", label: "Projects" },
  { id: "reports", label: "Reports" },
  { id: "data", label: "Data" },
] as const;

type WorkspaceFilterOptions = {
  sheetKey?: string | null;
  query?: string | null;
  savedView?: string | null;
};

function choosePreferredContact(contacts: Contact[]) {
  return (
    [...contacts].sort((a, b) => {
      const confidenceRank = { high: 0, medium: 1, low: 2 };
      const score = confidenceRank[a.confidence] - confidenceRank[b.confidence];

      if (score !== 0) {
        return score;
      }

      if (Boolean(a.email) !== Boolean(b.email)) {
        return a.email ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    })[0] ?? null
  );
}

function getDerivedStage(
  sequence: GeneratedSequence | null,
  outreachState: ProspectOutreachState | null,
  latestFinding: WebsiteAuditFinding | null,
): WorkspaceCompanyStage {
  const state = outreachState?.state ?? sequence?.state ?? null;

  switch (state) {
    case "drafted":
      return "drafted";
    case "approved":
      return "approved";
    case "scheduled":
      return "scheduled";
    case "sent":
      return "sent";
    case "replied":
      return "replied";
    case "booked":
      return "booked";
    case "nurture":
      return "nurture";
    case "closed":
      return "closed";
    case "needs_escalation":
      return "sent";
    case "no_show":
      return "booked";
    default:
      return latestFinding ? "audited" : "new";
  }
}

function nextStepLabel(sequence: GeneratedSequence | null, outreachState: ProspectOutreachState | null) {
  if (!sequence) {
    return null;
  }

  if (outreachState?.state === "replied" || outreachState?.state === "booked") {
    return "Follow the reply";
  }

  const nextDraft = sequence.steps.find(
    (step) => step.sendState === "draft" || step.sendState === "scheduled",
  );

  if (!nextDraft) {
    return null;
  }

  return `Step ${nextDraft.stepNumber} · Day ${nextDraft.dayOffset + 1}`;
}

function latestIso(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? "";
}

function matchesSearch(record: WorkspaceCompanyRecord, query: string | null | undefined) {
  if (!query?.trim()) {
    return true;
  }

  return record.searchText.includes(query.trim().toLowerCase());
}

function matchesSavedView(record: WorkspaceCompanyRecord, savedView: string | null | undefined) {
  switch (savedView) {
    case "needs_approval":
      return record.stage === "drafted";
    case "ready_to_send":
      return record.stage === "approved" || record.stage === "scheduled";
    case "replied_today":
      return (
        record.stage === "replied" &&
        record.latestActivityAt.slice(0, 10) === new Date().toISOString().slice(0, 10)
      );
    case "no_contact_found":
      return record.contacts.length === 0;
    case "booked":
      return record.stage === "booked";
    case "needs_escalation":
      return record.needsAttention;
    default:
      return true;
  }
}

export function formatWorkspaceStageLabel(stage: WorkspaceCompanyStage) {
  const labels: Record<WorkspaceCompanyStage, string> = {
    new: "New",
    audited: "Audited",
    drafted: "Drafted",
    approved: "Approved",
    scheduled: "Scheduled",
    sent: "Sent",
    replied: "Replied",
    booked: "Booked",
    nurture: "Nurture",
    closed: "Closed",
  };

  return labels[stage];
}

export function getWorkspaceStageClasses(stage: WorkspaceCompanyStage) {
  switch (stage) {
    case "booked":
      return "bg-emerald-50 text-emerald-700";
    case "replied":
      return "bg-sky-50 text-sky-700";
    case "nurture":
      return "bg-violet-50 text-violet-700";
    case "closed":
      return "bg-rose-50 text-rose-700";
    case "scheduled":
      return "bg-blue-50 text-blue-700";
    case "approved":
      return "bg-slate-950 text-white";
    case "sent":
      return "bg-slate-100 text-slate-700";
    case "drafted":
      return "bg-amber-50 text-amber-700";
    case "audited":
      return "bg-cyan-50 text-cyan-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function buildWorkspaceCompanyRecords(
  snapshot: OutreachSnapshot,
  options: WorkspaceFilterOptions = {},
) {
  const sheets = buildWorkspaceSheets({
    leads: snapshot.leads,
    contacts: snapshot.contacts,
    runs: snapshot.runs,
  });
  const sheetMap = new Map(sheets.map((sheet) => [sheet.key, sheet]));

  const records = snapshot.leads
    .map((lead) => {
      const contacts = snapshot.contacts.filter((candidate) => candidate.leadId === lead.id);
      const crm = snapshot.leadCrmMetadata.find((candidate) => candidate.leadId === lead.id) ?? null;
      const campaignLead =
        snapshot.campaignLeads
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const campaign =
        (campaignLead
          ? snapshot.campaigns.find((candidate) => candidate.id === campaignLead.campaignId)
          : null) ?? null;
      const sequence =
        (campaignLead?.sequenceId
          ? snapshot.generatedSequences.find((candidate) => candidate.id === campaignLead.sequenceId)
          : snapshot.generatedSequences
              .filter((candidate) => candidate.leadId === lead.id)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]) ?? null;
      const outreachState =
        (campaignLead?.outreachStateId
          ? snapshot.outreachStates.find((candidate) => candidate.id === campaignLead.outreachStateId)
          : snapshot.outreachStates
              .filter((candidate) => candidate.leadId === lead.id)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]) ?? null;
      const latestFinding =
        snapshot.auditFindings
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const latestVariables =
        snapshot.prospectVariables
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const thread =
        snapshot.emailThreads
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))[0] ?? null;
      const mailbox =
        (campaign?.mailboxId
          ? snapshot.connectedMailboxes.find((candidate) => candidate.id === campaign.mailboxId)
          : null) ?? null;
      const opportunity =
        snapshot.opportunities
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const latestProposal =
        snapshot.proposalDocuments
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const client =
        snapshot.clients
          .filter((candidate) => candidate.leadId === lead.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      const reminders = snapshot.reminders
        .filter((candidate) => candidate.leadId === lead.id || candidate.opportunityId === opportunity?.id)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      const meetings = snapshot.meetings
        .filter((candidate) => candidate.leadId === lead.id || candidate.opportunityId === opportunity?.id)
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
      const activityNotes = snapshot.activityNotes
        .filter((candidate) => candidate.leadId === lead.id || candidate.clientId === client?.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const activeProjects = client
        ? snapshot.clientProjects
            .filter((candidate) => candidate.clientId === client.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [];
      const reports = client
        ? snapshot.monthlyReports
            .filter((candidate) => candidate.clientId === client.id)
            .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        : [];
      const preferredContact = choosePreferredContact(contacts);
      const stage = getDerivedStage(sequence, outreachState, latestFinding);
      const sheetKey = createSheetKey(lead.niche, lead.locationLabel);
      const sheetLabel = sheetMap.get(sheetKey)?.label ?? getDefaultSheetLabel(lead.niche, lead.locationLabel);
      const latestActivityAt = latestIso(
        lead.updatedAt,
        crm?.updatedAt,
        latestFinding?.updatedAt,
        sequence?.updatedAt,
        outreachState?.updatedAt,
        thread?.lastMessageAt,
      );
      const nextLabel = nextStepLabel(sequence, outreachState);
      const needsAttention =
        stage === "drafted" ||
        outreachState?.state === "needs_escalation" ||
        lead.stage === "contact_missing" ||
        lead.stage === "error";

      const record: WorkspaceCompanyRecord = {
        lead,
        crm,
        preferredContact,
        contacts,
        campaign,
        campaignLead,
        sequence,
        outreachState,
        thread,
        latestFinding,
        latestVariables,
        mailbox,
        opportunity,
        latestProposal,
        client,
        reminders,
        meetings,
        activityNotes,
        activeProjects,
        reports,
        stage,
        latestActivityAt,
        sourceSheetKey: sheetKey,
        sourceSheetLabel: sheetLabel,
        serviceAngle: campaign?.serviceKey ?? latestFinding?.serviceKey ?? null,
        nextStepLabel: crm?.nextAction
          ? crm.nextAction.replace(/_/g, " ")
          : nextLabel,
        needsAttention,
        searchText: [
          lead.companyName,
          lead.address,
          lead.websiteUri,
          lead.niche,
          lead.locationLabel,
          preferredContact?.name,
          preferredContact?.email,
          campaign?.name,
          latestFinding?.summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };

      return record;
    })
    .filter((record) => !record.crm?.archivedAt)
    .filter((record) => !options.sheetKey || record.sourceSheetKey === options.sheetKey)
    .filter((record) => matchesSearch(record, options.query))
    .filter((record) => matchesSavedView(record, options.savedView))
    .sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt));

  return records;
}

export function getWorkspaceKpis(records: WorkspaceCompanyRecord[], snapshot: OutreachSnapshot) {
  return {
    companyCount: records.length,
    contactCount: records.reduce((sum, record) => sum + record.contacts.length, 0),
    campaignCount: new Set(records.map((record) => record.campaign?.id).filter(Boolean)).size,
    repliedCount: records.filter((record) => record.stage === "replied").length,
    bookedCount: records.filter((record) => record.stage === "booked").length,
    needsAttentionCount: records.filter((record) => record.needsAttention).length,
    totalThreads: snapshot.emailThreads.filter((thread) =>
      records.some((record) => record.lead.id === thread.leadId),
    ).length,
    openOpportunities: records.filter((record) => record.opportunity?.status === "open").length,
    activeClients: records.filter((record) => Boolean(record.client)).length,
  };
}

export function groupWorkspacePipeline(records: WorkspaceCompanyRecord[]) {
  const orderedStages: WorkspaceCompanyStage[] = [
    "new",
    "audited",
    "drafted",
    "approved",
    "scheduled",
    "sent",
    "replied",
    "booked",
    "nurture",
    "closed",
  ];

  return orderedStages.map((stage) => ({
    stage,
    label: formatWorkspaceStageLabel(stage),
    records: records.filter((record) => record.stage === stage),
  }));
}

export function formatNextActionLabel(value: LeadCrmMetadata["nextAction"] | null) {
  if (!value) {
    return "None";
  }

  return value.replace(/_/g, " ");
}

export function formatPriorityLabel(value: LeadCrmMetadata["priority"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
