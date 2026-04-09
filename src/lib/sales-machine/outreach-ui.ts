import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import type {
  CampaignLead,
  CampaignMetrics,
  Contact,
  EmailThread,
  GeneratedSequence,
  Lead,
  OutreachSnapshot,
  ProspectOutreachState,
  ProspectVariableSet,
  ServiceKey,
  WebsiteAuditFinding,
  WorkflowRun,
} from "@/lib/sales-machine/types";

export type CampaignLeadRecord = {
  campaignLead: CampaignLead;
  lead: Lead | null;
  contact: Contact | null;
  finding: WebsiteAuditFinding | null;
  variables: ProspectVariableSet | null;
  sequence: GeneratedSequence | null;
  outreachState: ProspectOutreachState | null;
  thread: EmailThread | null;
};

function getRunCampaignId(run: WorkflowRun) {
  const candidate = run.input.campaignId;
  return typeof candidate === "string" ? candidate : null;
}

export function formatServiceLabel(serviceKey: ServiceKey) {
  const labels: Record<ServiceKey, string> = {
    seo: "SEO",
    webdesign: "Web Design",
    copywriting: "Copywriting",
    ai_automation: "AI Automation",
    marketing: "Marketing",
    lead_capture: "Lead Capture",
  };

  return labels[serviceKey];
}

export function formatAuditScopeLabel(scope: "run" | "sheet" | "all") {
  if (scope === "run") {
    return "Lead-search run";
  }

  if (scope === "sheet") {
    return "Workspace sheet";
  }

  return "All leads";
}

export function formatStateLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function getCampaignStatusClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "paused":
      return "bg-amber-50 text-amber-700";
    case "completed":
      return "bg-slate-900 text-white";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function getOutreachStateClasses(state: string) {
  switch (state) {
    case "booked":
      return "bg-emerald-50 text-emerald-700";
    case "replied":
      return "bg-sky-50 text-sky-700";
    case "nurture":
      return "bg-violet-50 text-violet-700";
    case "closed":
      return "bg-rose-50 text-rose-700";
    case "needs_escalation":
      return "bg-amber-50 text-amber-700";
    case "approved":
      return "bg-slate-900 text-white";
    case "scheduled":
      return "bg-blue-50 text-blue-700";
    case "sent":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function getOutreachShellStats(snapshot: OutreachSnapshot) {
  return [
    { label: "Campaigns", value: snapshot.campaigns.length.toString() },
    { label: "Leads", value: snapshot.campaignLeads.length.toString() },
    { label: "Ready", value: snapshot.stats.sequencesReadyCount.toString() },
    {
      label: "Replies / Booked",
      value: `${snapshot.stats.repliedCount} / ${snapshot.stats.bookedCount}`,
    },
    {
      label: "Nurture / Closed",
      value: `${snapshot.stats.nurtureCount} / ${snapshot.stats.closedCount}`,
    },
  ];
}

export function getMailboxUsage(snapshot: OutreachSnapshot, mailboxId: string) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const sentToday = snapshot.emailMessages.filter((message) => {
    if (message.mailboxId !== mailboxId) {
      return false;
    }

    if (message.direction !== "outbound" || message.status !== "sent") {
      return false;
    }

    const dateValue = message.sentAt ?? message.createdAt;
    return dateValue.slice(0, 10) === todayKey;
  }).length;

  const mailbox = snapshot.connectedMailboxes.find((candidate) => candidate.id === mailboxId);
  const remainingToday =
    mailbox?.dailyLimit == null ? null : Math.max(0, mailbox.dailyLimit - sentToday);

  return {
    sentToday,
    remainingToday,
  };
}

function emptyCampaignMetrics(campaignId: string): CampaignMetrics {
  return {
    campaignId,
    leadCount: 0,
    draftedCount: 0,
    approvedCount: 0,
    scheduledCount: 0,
    sentCount: 0,
    repliedCount: 0,
    bookedCount: 0,
    nurtureCount: 0,
    closedCount: 0,
    needsEscalationCount: 0,
  };
}

export async function getCampaignWorkspaceData(campaignId: string) {
  const snapshot = await getOutreachSnapshot();
  const campaign = snapshot.campaigns.find((candidate) => candidate.id === campaignId);

  if (!campaign) {
    return null;
  }

  const metrics =
    snapshot.campaignMetrics.find((candidate) => candidate.campaignId === campaignId) ??
    emptyCampaignMetrics(campaignId);
  const steps = snapshot.campaignSteps
    .filter((candidate) => candidate.campaignId === campaignId)
    .sort((a, b) => a.stepNumber - b.stepNumber);
  const campaignLeads = snapshot.campaignLeads
    .filter((candidate) => candidate.campaignId === campaignId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sequences = snapshot.generatedSequences
    .filter((candidate) => candidate.campaignId === campaignId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sequenceIds = new Set(sequences.map((sequence) => sequence.id));
  const leadIds = new Set(campaignLeads.map((candidate) => candidate.leadId));
  const threads = snapshot.emailThreads
    .filter(
      (candidate) =>
        candidate.campaignId === campaignId ||
        (candidate.sequenceId ? sequenceIds.has(candidate.sequenceId) : false) ||
        (candidate.leadId ? leadIds.has(candidate.leadId) : false),
    )
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const threadIds = new Set(threads.map((thread) => thread.id));
  const messages = snapshot.emailMessages
    .filter((candidate) => threadIds.has(candidate.threadId))
    .sort((a, b) => {
      const aValue = a.sentAt ?? a.createdAt;
      const bValue = b.sentAt ?? b.createdAt;
      return aValue.localeCompare(bValue);
    });
  const mailbox = snapshot.connectedMailboxes.find((candidate) => candidate.id === campaign.mailboxId) ?? null;
  const auditJobs = snapshot.auditJobs
    .filter((candidate) => candidate.campaignId === campaignId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const generationRuns = snapshot.runs
    .filter(
      (candidate) =>
        candidate.kind === "sequence-generation" && getRunCampaignId(candidate) === campaignId,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const auditRuns = snapshot.runs
    .filter((candidate) => candidate.kind === "website-audit" && getRunCampaignId(candidate) === campaignId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const inboxRuns = snapshot.runs
    .filter((candidate) => candidate.kind === "inbox-sync")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const leadRecords: CampaignLeadRecord[] = campaignLeads.map((campaignLead) => {
    const variables = campaignLead.variablesId
      ? snapshot.prospectVariables.find((candidate) => candidate.id === campaignLead.variablesId) ?? null
      : null;
    const sequence =
      (campaignLead.sequenceId
        ? sequences.find((candidate) => candidate.id === campaignLead.sequenceId)
        : null) ?? null;

    return {
      campaignLead,
      lead: snapshot.leads.find((candidate) => candidate.id === campaignLead.leadId) ?? null,
      contact:
        (campaignLead.contactId
          ? snapshot.contacts.find((candidate) => candidate.id === campaignLead.contactId)
          : null) ?? null,
      finding:
        (campaignLead.findingId
          ? snapshot.auditFindings.find((candidate) => candidate.id === campaignLead.findingId)
          : null) ?? null,
      variables,
      sequence,
      outreachState:
        (campaignLead.outreachStateId
          ? snapshot.outreachStates.find((candidate) => candidate.id === campaignLead.outreachStateId)
          : sequence
            ? snapshot.outreachStates.find((candidate) => candidate.sequenceId === sequence.id)
            : null) ?? null,
      thread:
        (sequence
          ? threads.find((candidate) => candidate.sequenceId === sequence.id)
          : threads.find((candidate) => candidate.leadId === campaignLead.leadId)) ?? null,
    };
  });

  return {
    snapshot,
    campaign,
    metrics,
    steps,
    sequences,
    campaignLeads,
    leadRecords,
    threads,
    messages,
    mailbox,
    auditJobs,
    generationRuns,
    auditRuns,
    inboxRuns,
    latestAuditJob: auditJobs[0] ?? null,
    latestGenerationRun: generationRuns[0] ?? null,
    latestThread: threads[0] ?? null,
  };
}
