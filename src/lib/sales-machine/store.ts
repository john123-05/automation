import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getBillingOverview } from "@/lib/billing/overview";
import { getStorageMode } from "@/lib/env";
import { ensureAgencySeedData } from "@/lib/sales-machine/agency-seeds";
import { ensureOutreachSeedData } from "@/lib/sales-machine/outreach-seeds";
import { getSupabaseAdminClient, salesMachineTables } from "@/lib/sales-machine/supabase";
import type {
  ActivityNote,
  Campaign,
  CampaignLead,
  CampaignMetrics,
  CampaignStep,
  Client,
  ClientAsset,
  ClientAssetRequest,
  ClientProject,
  ConnectedMailbox,
  Contact,
  DashboardSnapshot,
  EmailMessage,
  EmailThread,
  EnrichmentJob,
  GeneratedSequence,
  Lead,
  LeadCrmMetadata,
  Meeting,
  MonthlyReport,
  OutreachSnapshot,
  Opportunity,
  ProspectOutreachState,
  ProspectVariableSet,
  ProjectTask,
  ProposalDocument,
  ProposalTemplate,
  Reminder,
  ReportingConnection,
  SalesMachineDb,
  SearchJob,
  SequenceTemplate,
  ServiceOfferProfile,
  ServiceProfile,
  SuppressionEntry,
  WebsiteAuditFinding,
  WebsiteAuditJob,
  WorkflowRun,
} from "@/lib/sales-machine/types";
import { buildWorkspaceSheets } from "@/lib/sales-machine/workspace-sheets";

type LeadRow = {
  id: string;
  company_name: string;
  address: string;
  website_uri: string | null;
  rating: number | null;
  national_phone_number: string | null;
  international_phone_number: string | null;
  latitude: number | null;
  longitude: number | null;
  niche: string;
  location_label: string;
  source: Lead["source"];
  stage: Lead["stage"];
  person_searched: boolean;
  contact_count: number;
  research_summary: string | null;
  last_error: string | null;
  last_run_id: string | null;
  discovered_at: string;
  updated_at: string;
};

type LeadCrmMetadataRow = {
  id: string;
  lead_id: string;
  notes: string | null;
  priority: LeadCrmMetadata["priority"];
  next_action: LeadCrmMetadata["nextAction"];
  next_action_due_at: string | null;
  owner_label: string | null;
  archived_at: string | null;
  updated_at: string;
};

type ContactRow = {
  id: string;
  lead_id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedin: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  confidence: Contact["confidence"];
  source: Contact["source"];
  discovered_at: string;
};

type WorkflowRunRow = {
  id: string;
  kind: WorkflowRun["kind"];
  status: WorkflowRun["status"];
  input: WorkflowRun["input"];
  summary: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  steps: WorkflowRun["steps"];
};

type SearchJobRow = {
  id: string;
  run_id: string;
  niche: string;
  location_label: string;
  radius_meters: number;
  target_max_leads: number;
  status: SearchJob["status"];
  next_page_token: string | null;
  pages_fetched: number;
  leads_collected: number;
  warnings: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type EnrichmentJobRow = {
  id: string;
  run_id: string;
  batch_size: number;
  provider_order: EnrichmentJob["providerOrder"];
  status: EnrichmentJob["status"];
  leads_claimed: number;
  leads_processed: number;
  enriched_count: number;
  missing_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type ServiceProfileRow = {
  id: string;
  service_key: ServiceProfile["serviceKey"];
  label: string;
  short_description: string;
  audit_rules: string[];
  created_at: string;
  updated_at: string;
};

type WebsiteAuditJobRow = {
  id: string;
  campaign_id: string | null;
  run_id: string;
  service_key: WebsiteAuditJob["serviceKey"];
  scope: WebsiteAuditJob["scope"];
  source_run_id: string | null;
  sheet_key: string | null;
  batch_size: number;
  status: WebsiteAuditJob["status"];
  leads_claimed: number;
  leads_processed: number;
  findings_created: number;
  failed_count: number;
  current_lead_id: string | null;
  current_lead_name: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type WebsiteAuditFindingRow = {
  id: string;
  lead_id: string;
  service_key: WebsiteAuditFinding["serviceKey"];
  job_id: string;
  issue_type: WebsiteAuditFinding["issueType"];
  page_url: string | null;
  page_label: string | null;
  summary: string;
  recognizable_reason: string;
  consequence_mechanics: string;
  review_time: string;
  micro_yes: string;
  preview_asset_exists: boolean;
  evidence: string[];
  raw_signals: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProspectVariableSetRow = {
  id: string;
  lead_id: string;
  service_key: ProspectVariableSet["serviceKey"];
  finding_id: string;
  contact_id: string | null;
  variables: ProspectVariableSet["variables"];
  created_at: string;
  updated_at: string;
};

type SequenceTemplateRow = {
  id: string;
  service_key: SequenceTemplate["serviceKey"];
  step_number: SequenceTemplate["stepNumber"];
  day_offset: number;
  subject_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
};

type GeneratedSequenceRow = {
  id: string;
  campaign_id: string | null;
  lead_id: string;
  service_key: GeneratedSequence["serviceKey"];
  finding_id: string;
  variables_id: string;
  mailbox_id: string | null;
  state: GeneratedSequence["state"];
  steps: GeneratedSequence["steps"];
  generated_at: string;
  approved_at: string | null;
  updated_at: string;
};

type CampaignRow = {
  id: string;
  name: string;
  service_key: Campaign["serviceKey"];
  status: Campaign["status"];
  source_scope: Campaign["sourceScope"];
  source_run_id: string | null;
  sheet_key: string | null;
  mailbox_id: string | null;
  timezone: string;
  send_window_start: string;
  send_window_end: string;
  allowed_weekdays: number[];
  stop_on_reply: boolean;
  wait_hours_after_final_step: number;
  created_at: string;
  updated_at: string;
};

type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_number: CampaignStep["stepNumber"];
  day_offset: number;
  subject_template: string;
  body_template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type CampaignLeadRow = {
  id: string;
  campaign_id: string;
  lead_id: string;
  contact_id: string | null;
  finding_id: string | null;
  variables_id: string | null;
  sequence_id: string | null;
  outreach_state_id: string | null;
  status: CampaignLead["status"];
  created_at: string;
  updated_at: string;
};

type ConnectedMailboxRow = {
  id: string;
  provider: ConnectedMailbox["provider"];
  email: string;
  display_name: string | null;
  status: ConnectedMailbox["status"];
  signature: string | null;
  daily_limit: number | null;
  oauth_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type EmailThreadRow = {
  id: string;
  campaign_id: string | null;
  mailbox_id: string;
  lead_id: string | null;
  service_key: EmailThread["serviceKey"];
  sequence_id: string | null;
  external_thread_id: string | null;
  subject: string;
  snippet: string | null;
  contact_name: string | null;
  contact_email: string | null;
  state: EmailThread["state"];
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

type EmailMessageRow = {
  id: string;
  thread_id: string;
  mailbox_id: string;
  external_message_id: string | null;
  direction: EmailMessage["direction"];
  status: EmailMessage["status"];
  subject: string;
  body_text: string;
  from_address: string | null;
  to_address: string | null;
  sent_at: string | null;
  created_at: string;
};

type ProspectOutreachStateRow = {
  id: string;
  campaign_id: string | null;
  lead_id: string;
  service_key: ProspectOutreachState["serviceKey"];
  mailbox_id: string | null;
  sequence_id: string | null;
  thread_id: string | null;
  state: ProspectOutreachState["state"];
  next_step_number: number | null;
  notes: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

type SuppressionEntryRow = {
  id: string;
  email: string | null;
  domain: string | null;
  reason: string;
  source: SuppressionEntry["source"];
  created_at: string;
};

type OpportunityRow = {
  id: string;
  lead_id: string;
  contact_id: string | null;
  service_key: Opportunity["serviceKey"];
  source_campaign_id: string | null;
  stage: Opportunity["stage"];
  status: Opportunity["status"];
  estimated_value_usd: number | null;
  close_probability: number | null;
  next_step: string | null;
  next_step_due_at: string | null;
  last_touch_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MeetingRow = {
  id: string;
  opportunity_id: string | null;
  lead_id: string;
  contact_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  agenda: string | null;
  prep_notes: string | null;
  outcome: string | null;
  follow_up_due_at: string | null;
  status: Meeting["status"];
  created_at: string;
  updated_at: string;
};

type ProposalTemplateRow = {
  id: string;
  service_key: ProposalTemplate["serviceKey"];
  title_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
};

type ProposalDocumentRow = {
  id: string;
  opportunity_id: string;
  lead_id: string;
  contact_id: string | null;
  service_key: ProposalDocument["serviceKey"];
  status: ProposalDocument["status"];
  title: string;
  amount_usd: number | null;
  content: string;
  doc_url: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClientRow = {
  id: string;
  lead_id: string;
  primary_contact_id: string | null;
  source_opportunity_id: string | null;
  status: Client["status"];
  start_date: string | null;
  retainer_type: Client["retainerType"];
  billing_cycle: string | null;
  notes: string | null;
  drive_folder_url: string | null;
  created_at: string;
  updated_at: string;
};

type ClientProjectRow = {
  id: string;
  client_id: string;
  service_key: ClientProject["serviceKey"];
  name: string;
  status: ClientProject["status"];
  start_date: string | null;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectTaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: ProjectTask["status"];
  due_at: string | null;
  notes: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClientAssetRow = {
  id: string;
  client_id: string;
  label: string;
  kind: string;
  drive_url: string | null;
  status: ClientAsset["status"];
  created_at: string;
  updated_at: string;
};

type ClientAssetRequestRow = {
  id: string;
  client_id: string;
  type: string;
  status: ClientAssetRequest["status"];
  description: string | null;
  requested_at: string;
  received_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderRow = {
  id: string;
  lead_id: string | null;
  opportunity_id: string | null;
  client_id: string | null;
  project_id: string | null;
  title: string;
  due_at: string;
  status: Reminder["status"];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityNoteRow = {
  id: string;
  entity_type: ActivityNote["entityType"];
  entity_id: string;
  lead_id: string | null;
  client_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type ServiceOfferProfileRow = {
  id: string;
  service_key: ServiceOfferProfile["serviceKey"];
  label: string;
  scope_defaults: string;
  pricing_notes: string | null;
  objection_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ReportingConnectionRow = {
  id: string;
  client_id: string;
  kind: ReportingConnection["kind"];
  target: string;
  status: ReportingConnection["status"];
  settings: ReportingConnection["settings"];
  created_at: string;
  updated_at: string;
};

type MonthlyReportRow = {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  status: MonthlyReport["status"];
  title: string;
  summary: string;
  content: string;
  metrics_snapshot: MonthlyReport["metricsSnapshot"];
  doc_url: string | null;
  generated_at: string;
  updated_at: string;
};

const dataDirectory = path.join(process.cwd(), ".data");
const databasePath = path.join(dataDirectory, "sales-machine.json");

const supabaseNativeRunKinds = new Set<WorkflowRun["kind"]>([
  "lead-search",
  "contact-enrichment",
]);

const emptyDb = (): SalesMachineDb => ({
  leads: [],
  leadCrmMetadata: [],
  contacts: [],
  runs: [],
  searchJobs: [],
  enrichmentJobs: [],
  serviceProfiles: [],
  auditJobs: [],
  auditFindings: [],
  prospectVariables: [],
  sequenceTemplates: [],
  campaigns: [],
  campaignSteps: [],
  campaignLeads: [],
  generatedSequences: [],
  connectedMailboxes: [],
  emailThreads: [],
  emailMessages: [],
  outreachStates: [],
  suppressionEntries: [],
  opportunities: [],
  meetings: [],
  proposalTemplates: [],
  proposalDocuments: [],
  clients: [],
  clientProjects: [],
  projectTasks: [],
  clientAssets: [],
  clientAssetRequests: [],
  reminders: [],
  activityNotes: [],
  serviceOfferProfiles: [],
  reportingConnections: [],
  monthlyReports: [],
});

let mutationQueue = Promise.resolve();

function isSupabaseNativeRunKind(kind: WorkflowRun["kind"]) {
  return supabaseNativeRunKinds.has(kind);
}

function mergeById<T extends { id: string }>(
  primary: ReadonlyArray<T>,
  secondary: ReadonlyArray<T>,
) {
  const merged = new Map<string, T>();

  for (const item of primary) {
    merged.set(item.id, item);
  }

  for (const item of secondary) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

function ensureArrays(value: Partial<SalesMachineDb> | null | undefined): SalesMachineDb {
  const db = {
    ...emptyDb(),
    ...value,
    leads: (value?.leads ?? []).map((lead) => {
      const candidate = lead as Lead & { lastRunId?: string | null };

      return {
        ...candidate,
        searchRunId: candidate.searchRunId ?? candidate.lastRunId ?? null,
      };
    }),
    leadCrmMetadata: value?.leadCrmMetadata ?? [],
    contacts: value?.contacts ?? [],
    runs: value?.runs ?? [],
    searchJobs: value?.searchJobs ?? [],
    enrichmentJobs: value?.enrichmentJobs ?? [],
    serviceProfiles: value?.serviceProfiles ?? [],
    auditJobs: value?.auditJobs ?? [],
    auditFindings: value?.auditFindings ?? [],
    prospectVariables: value?.prospectVariables ?? [],
    sequenceTemplates: value?.sequenceTemplates ?? [],
    campaigns: value?.campaigns ?? [],
    campaignSteps: value?.campaignSteps ?? [],
    campaignLeads: value?.campaignLeads ?? [],
    generatedSequences: value?.generatedSequences ?? [],
    connectedMailboxes: value?.connectedMailboxes ?? [],
    emailThreads: value?.emailThreads ?? [],
    emailMessages: value?.emailMessages ?? [],
    outreachStates: value?.outreachStates ?? [],
    suppressionEntries: value?.suppressionEntries ?? [],
    opportunities: value?.opportunities ?? [],
    meetings: value?.meetings ?? [],
    proposalTemplates: value?.proposalTemplates ?? [],
    proposalDocuments: value?.proposalDocuments ?? [],
    clients: value?.clients ?? [],
    clientProjects: value?.clientProjects ?? [],
    projectTasks: value?.projectTasks ?? [],
    clientAssets: value?.clientAssets ?? [],
    clientAssetRequests: value?.clientAssetRequests ?? [],
    reminders: value?.reminders ?? [],
    activityNotes: value?.activityNotes ?? [],
    serviceOfferProfiles: value?.serviceOfferProfiles ?? [],
    reportingConnections: value?.reportingConnections ?? [],
    monthlyReports: value?.monthlyReports ?? [],
  } satisfies SalesMachineDb;

  ensureOutreachSeedData(db);
  ensureAgencySeedData(db);
  return db;
}

async function ensureDbFile() {
  try {
    await readFile(databasePath, "utf8");
  } catch {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(databasePath, JSON.stringify(emptyDb(), null, 2), "utf8");
  }
}

async function readLocalDb() {
  await ensureDbFile();
  const raw = await readFile(databasePath, "utf8");
  return ensureArrays(JSON.parse(raw) as Partial<SalesMachineDb>);
}

async function writeLocalDb(db: SalesMachineDb) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(databasePath, JSON.stringify(db, null, 2), "utf8");
}

function isMissingSupabaseTableError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("schema cache")
  );
}

function expectSupabaseData<T>(
  error: { message?: string; code?: string } | null,
  data: T | null,
  options?: { optional?: boolean },
) {
  if (error) {
    if (options?.optional && isMissingSupabaseTableError(error)) {
      return [] as unknown as T;
    }

    throw new Error(error.message);
  }

  return data;
}

function leadFromRow(row: LeadRow): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    address: row.address,
    websiteUri: row.website_uri,
    rating: row.rating,
    nationalPhoneNumber: row.national_phone_number,
    internationalPhoneNumber: row.international_phone_number,
    latitude: row.latitude,
    longitude: row.longitude,
    niche: row.niche,
    locationLabel: row.location_label,
    source: row.source,
    stage: row.stage,
    personSearched: row.person_searched,
    contactCount: row.contact_count,
    researchSummary: row.research_summary,
    lastError: row.last_error,
    searchRunId: row.last_run_id,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
  };
}

function leadToRow(lead: Lead): LeadRow {
  return {
    id: lead.id,
    company_name: lead.companyName,
    address: lead.address,
    website_uri: lead.websiteUri,
    rating: lead.rating,
    national_phone_number: lead.nationalPhoneNumber,
    international_phone_number: lead.internationalPhoneNumber,
    latitude: lead.latitude,
    longitude: lead.longitude,
    niche: lead.niche,
    location_label: lead.locationLabel,
    source: lead.source,
    stage: lead.stage,
    person_searched: lead.personSearched,
    contact_count: lead.contactCount,
    research_summary: lead.researchSummary,
    last_error: lead.lastError,
    last_run_id: lead.searchRunId,
    discovered_at: lead.discoveredAt,
    updated_at: lead.updatedAt,
  };
}

function leadCrmMetadataFromRow(row: LeadCrmMetadataRow): LeadCrmMetadata {
  return {
    id: row.id,
    leadId: row.lead_id,
    notes: row.notes,
    priority: row.priority,
    nextAction: row.next_action,
    nextActionDueAt: row.next_action_due_at,
    ownerLabel: row.owner_label,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

function leadCrmMetadataToRow(metadata: LeadCrmMetadata): LeadCrmMetadataRow {
  return {
    id: metadata.id,
    lead_id: metadata.leadId,
    notes: metadata.notes,
    priority: metadata.priority,
    next_action: metadata.nextAction,
    next_action_due_at: metadata.nextActionDueAt,
    owner_label: metadata.ownerLabel,
    archived_at: metadata.archivedAt,
    updated_at: metadata.updatedAt,
  };
}

function contactFromRow(row: ContactRow): Contact {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    title: row.title,
    email: row.email,
    linkedin: row.linkedin,
    instagram: row.instagram,
    twitter: row.twitter,
    facebook: row.facebook,
    confidence: row.confidence,
    source: row.source,
    discoveredAt: row.discovered_at,
  };
}

function contactToRow(contact: Contact): ContactRow {
  return {
    id: contact.id,
    lead_id: contact.leadId,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    linkedin: contact.linkedin,
    instagram: contact.instagram,
    twitter: contact.twitter,
    facebook: contact.facebook,
    confidence: contact.confidence,
    source: contact.source,
    discovered_at: contact.discoveredAt,
  };
}

function runFromRow(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    input: row.input ?? {},
    summary: row.summary,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    steps: Array.isArray(row.steps) ? row.steps : [],
  };
}

function runToRow(run: WorkflowRun): WorkflowRunRow {
  return {
    id: run.id,
    kind: run.kind,
    status: run.status,
    input: run.input,
    summary: run.summary,
    error: run.error,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    steps: run.steps,
  };
}

function searchJobFromRow(row: SearchJobRow): SearchJob {
  return {
    id: row.id,
    runId: row.run_id,
    niche: row.niche,
    locationLabel: row.location_label,
    radiusMeters: row.radius_meters,
    targetMaxLeads: row.target_max_leads,
    status: row.status,
    nextPageToken: row.next_page_token,
    pagesFetched: row.pages_fetched,
    leadsCollected: row.leads_collected,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

function searchJobToRow(job: SearchJob): SearchJobRow {
  return {
    id: job.id,
    run_id: job.runId,
    niche: job.niche,
    location_label: job.locationLabel,
    radius_meters: job.radiusMeters,
    target_max_leads: job.targetMaxLeads,
    status: job.status,
    next_page_token: job.nextPageToken,
    pages_fetched: job.pagesFetched,
    leads_collected: job.leadsCollected,
    warnings: job.warnings,
    error: job.error,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    finished_at: job.finishedAt,
  };
}

function enrichmentJobFromRow(row: EnrichmentJobRow): EnrichmentJob {
  return {
    id: row.id,
    runId: row.run_id,
    batchSize: row.batch_size,
    providerOrder: Array.isArray(row.provider_order) ? row.provider_order : [],
    status: row.status,
    leadsClaimed: row.leads_claimed,
    leadsProcessed: row.leads_processed,
    enrichedCount: row.enriched_count,
    missingCount: row.missing_count,
    failedCount: row.failed_count,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

function enrichmentJobToRow(job: EnrichmentJob): EnrichmentJobRow {
  return {
    id: job.id,
    run_id: job.runId,
    batch_size: job.batchSize,
    provider_order: job.providerOrder,
    status: job.status,
    leads_claimed: job.leadsClaimed,
    leads_processed: job.leadsProcessed,
    enriched_count: job.enrichedCount,
    missing_count: job.missingCount,
    failed_count: job.failedCount,
    error: job.error,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    finished_at: job.finishedAt,
  };
}

function serviceProfileFromRow(row: ServiceProfileRow): ServiceProfile {
  return {
    id: row.id,
    serviceKey: row.service_key,
    label: row.label,
    shortDescription: row.short_description,
    auditRules: Array.isArray(row.audit_rules) ? row.audit_rules : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serviceProfileToRow(profile: ServiceProfile): ServiceProfileRow {
  return {
    id: profile.id,
    service_key: profile.serviceKey,
    label: profile.label,
    short_description: profile.shortDescription,
    audit_rules: profile.auditRules,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function auditJobFromRow(row: WebsiteAuditJobRow): WebsiteAuditJob {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    runId: row.run_id,
    serviceKey: row.service_key,
    scope: row.scope,
    sourceRunId: row.source_run_id,
    sheetKey: row.sheet_key,
    batchSize: row.batch_size,
    status: row.status,
    leadsClaimed: row.leads_claimed,
    leadsProcessed: row.leads_processed,
    findingsCreated: row.findings_created,
    failedCount: row.failed_count,
    currentLeadId: row.current_lead_id,
    currentLeadName: row.current_lead_name,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

function auditJobToRow(job: WebsiteAuditJob): WebsiteAuditJobRow {
  return {
    id: job.id,
    campaign_id: job.campaignId,
    run_id: job.runId,
    service_key: job.serviceKey,
    scope: job.scope,
    source_run_id: job.sourceRunId,
    sheet_key: job.sheetKey,
    batch_size: job.batchSize,
    status: job.status,
    leads_claimed: job.leadsClaimed,
    leads_processed: job.leadsProcessed,
    findings_created: job.findingsCreated,
    failed_count: job.failedCount,
    current_lead_id: job.currentLeadId,
    current_lead_name: job.currentLeadName,
    error: job.error,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    finished_at: job.finishedAt,
  };
}

function auditFindingFromRow(row: WebsiteAuditFindingRow): WebsiteAuditFinding {
  return {
    id: row.id,
    leadId: row.lead_id,
    serviceKey: row.service_key,
    jobId: row.job_id,
    issueType: row.issue_type,
    pageUrl: row.page_url,
    pageLabel: row.page_label,
    summary: row.summary,
    recognizableReason: row.recognizable_reason,
    consequenceMechanics: row.consequence_mechanics,
    reviewTime: row.review_time,
    microYes: row.micro_yes,
    previewAssetExists: row.preview_asset_exists,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    rawSignals: row.raw_signals ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function auditFindingToRow(finding: WebsiteAuditFinding): WebsiteAuditFindingRow {
  return {
    id: finding.id,
    lead_id: finding.leadId,
    service_key: finding.serviceKey,
    job_id: finding.jobId,
    issue_type: finding.issueType,
    page_url: finding.pageUrl,
    page_label: finding.pageLabel,
    summary: finding.summary,
    recognizable_reason: finding.recognizableReason,
    consequence_mechanics: finding.consequenceMechanics,
    review_time: finding.reviewTime,
    micro_yes: finding.microYes,
    preview_asset_exists: finding.previewAssetExists,
    evidence: finding.evidence,
    raw_signals: finding.rawSignals,
    created_at: finding.createdAt,
    updated_at: finding.updatedAt,
  };
}

function prospectVariableFromRow(row: ProspectVariableSetRow): ProspectVariableSet {
  return {
    id: row.id,
    leadId: row.lead_id,
    serviceKey: row.service_key,
    findingId: row.finding_id,
    contactId: row.contact_id,
    variables: row.variables ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function prospectVariableToRow(variable: ProspectVariableSet): ProspectVariableSetRow {
  return {
    id: variable.id,
    lead_id: variable.leadId,
    service_key: variable.serviceKey,
    finding_id: variable.findingId,
    contact_id: variable.contactId,
    variables: variable.variables,
    created_at: variable.createdAt,
    updated_at: variable.updatedAt,
  };
}

function sequenceTemplateFromRow(row: SequenceTemplateRow): SequenceTemplate {
  return {
    id: row.id,
    serviceKey: row.service_key,
    stepNumber: row.step_number,
    dayOffset: row.day_offset,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sequenceTemplateToRow(template: SequenceTemplate): SequenceTemplateRow {
  return {
    id: template.id,
    service_key: template.serviceKey,
    step_number: template.stepNumber,
    day_offset: template.dayOffset,
    subject_template: template.subjectTemplate,
    body_template: template.bodyTemplate,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

function generatedSequenceFromRow(row: GeneratedSequenceRow): GeneratedSequence {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    serviceKey: row.service_key,
    findingId: row.finding_id,
    variablesId: row.variables_id,
    mailboxId: row.mailbox_id,
    state: row.state,
    steps: Array.isArray(row.steps) ? row.steps : [],
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
  };
}

function generatedSequenceToRow(sequence: GeneratedSequence): GeneratedSequenceRow {
  return {
    id: sequence.id,
    campaign_id: sequence.campaignId,
    lead_id: sequence.leadId,
    service_key: sequence.serviceKey,
    finding_id: sequence.findingId,
    variables_id: sequence.variablesId,
    mailbox_id: sequence.mailboxId,
    state: sequence.state,
    steps: sequence.steps,
    generated_at: sequence.generatedAt,
    approved_at: sequence.approvedAt,
    updated_at: sequence.updatedAt,
  };
}

function campaignFromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    serviceKey: row.service_key,
    status: row.status,
    sourceScope: row.source_scope,
    sourceRunId: row.source_run_id,
    sheetKey: row.sheet_key,
    mailboxId: row.mailbox_id,
    timezone: row.timezone,
    sendWindowStart: row.send_window_start,
    sendWindowEnd: row.send_window_end,
    allowedWeekdays: Array.isArray(row.allowed_weekdays) ? row.allowed_weekdays : [1, 2, 3, 4, 5],
    stopOnReply: row.stop_on_reply,
    waitHoursAfterFinalStep: row.wait_hours_after_final_step,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function campaignToRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
    name: campaign.name,
    service_key: campaign.serviceKey,
    status: campaign.status,
    source_scope: campaign.sourceScope,
    source_run_id: campaign.sourceRunId,
    sheet_key: campaign.sheetKey,
    mailbox_id: campaign.mailboxId,
    timezone: campaign.timezone,
    send_window_start: campaign.sendWindowStart,
    send_window_end: campaign.sendWindowEnd,
    allowed_weekdays: campaign.allowedWeekdays,
    stop_on_reply: campaign.stopOnReply,
    wait_hours_after_final_step: campaign.waitHoursAfterFinalStep,
    created_at: campaign.createdAt,
    updated_at: campaign.updatedAt,
  };
}

function campaignStepFromRow(row: CampaignStepRow): CampaignStep {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    stepNumber: row.step_number,
    dayOffset: row.day_offset,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function campaignStepToRow(step: CampaignStep): CampaignStepRow {
  return {
    id: step.id,
    campaign_id: step.campaignId,
    step_number: step.stepNumber,
    day_offset: step.dayOffset,
    subject_template: step.subjectTemplate,
    body_template: step.bodyTemplate,
    enabled: step.enabled,
    created_at: step.createdAt,
    updated_at: step.updatedAt,
  };
}

function campaignLeadFromRow(row: CampaignLeadRow): CampaignLead {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    contactId: row.contact_id,
    findingId: row.finding_id,
    variablesId: row.variables_id,
    sequenceId: row.sequence_id,
    outreachStateId: row.outreach_state_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function campaignLeadToRow(campaignLead: CampaignLead): CampaignLeadRow {
  return {
    id: campaignLead.id,
    campaign_id: campaignLead.campaignId,
    lead_id: campaignLead.leadId,
    contact_id: campaignLead.contactId,
    finding_id: campaignLead.findingId,
    variables_id: campaignLead.variablesId,
    sequence_id: campaignLead.sequenceId,
    outreach_state_id: campaignLead.outreachStateId,
    status: campaignLead.status,
    created_at: campaignLead.createdAt,
    updated_at: campaignLead.updatedAt,
  };
}

function mailboxFromRow(row: ConnectedMailboxRow): ConnectedMailbox {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    signature: row.signature,
    dailyLimit: row.daily_limit,
    oauthData: row.oauth_data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mailboxToRow(mailbox: ConnectedMailbox): ConnectedMailboxRow {
  return {
    id: mailbox.id,
    provider: mailbox.provider,
    email: mailbox.email,
    display_name: mailbox.displayName,
    status: mailbox.status,
    signature: mailbox.signature,
    daily_limit: mailbox.dailyLimit,
    oauth_data: mailbox.oauthData,
    created_at: mailbox.createdAt,
    updated_at: mailbox.updatedAt,
  };
}

function emailThreadFromRow(row: EmailThreadRow): EmailThread {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    mailboxId: row.mailbox_id,
    leadId: row.lead_id,
    serviceKey: row.service_key,
    sequenceId: row.sequence_id,
    externalThreadId: row.external_thread_id,
    subject: row.subject,
    snippet: row.snippet,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    state: row.state,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emailThreadToRow(thread: EmailThread): EmailThreadRow {
  return {
    id: thread.id,
    campaign_id: thread.campaignId,
    mailbox_id: thread.mailboxId,
    lead_id: thread.leadId,
    service_key: thread.serviceKey,
    sequence_id: thread.sequenceId,
    external_thread_id: thread.externalThreadId,
    subject: thread.subject,
    snippet: thread.snippet,
    contact_name: thread.contactName,
    contact_email: thread.contactEmail,
    state: thread.state,
    last_message_at: thread.lastMessageAt,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
  };
}

function emailMessageFromRow(row: EmailMessageRow): EmailMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    mailboxId: row.mailbox_id,
    externalMessageId: row.external_message_id,
    direction: row.direction,
    status: row.status,
    subject: row.subject,
    bodyText: row.body_text,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function emailMessageToRow(message: EmailMessage): EmailMessageRow {
  return {
    id: message.id,
    thread_id: message.threadId,
    mailbox_id: message.mailboxId,
    external_message_id: message.externalMessageId,
    direction: message.direction,
    status: message.status,
    subject: message.subject,
    body_text: message.bodyText,
    from_address: message.fromAddress,
    to_address: message.toAddress,
    sent_at: message.sentAt,
    created_at: message.createdAt,
  };
}

function outreachStateFromRow(row: ProspectOutreachStateRow): ProspectOutreachState {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    serviceKey: row.service_key,
    mailboxId: row.mailbox_id,
    sequenceId: row.sequence_id,
    threadId: row.thread_id,
    state: row.state,
    nextStepNumber: row.next_step_number,
    notes: row.notes,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function outreachStateToRow(state: ProspectOutreachState): ProspectOutreachStateRow {
  return {
    id: state.id,
    campaign_id: state.campaignId,
    lead_id: state.leadId,
    service_key: state.serviceKey,
    mailbox_id: state.mailboxId,
    sequence_id: state.sequenceId,
    thread_id: state.threadId,
    state: state.state,
    next_step_number: state.nextStepNumber,
    notes: state.notes,
    last_activity_at: state.lastActivityAt,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
  };
}

function suppressionEntryFromRow(row: SuppressionEntryRow): SuppressionEntry {
  return {
    id: row.id,
    email: row.email,
    domain: row.domain,
    reason: row.reason,
    source: row.source,
    createdAt: row.created_at,
  };
}

function suppressionEntryToRow(entry: SuppressionEntry): SuppressionEntryRow {
  return {
    id: entry.id,
    email: entry.email,
    domain: entry.domain,
    reason: entry.reason,
    source: entry.source,
    created_at: entry.createdAt,
  };
}

function opportunityFromRow(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    leadId: row.lead_id,
    contactId: row.contact_id,
    serviceKey: row.service_key,
    sourceCampaignId: row.source_campaign_id,
    stage: row.stage,
    status: row.status,
    estimatedValueUsd: row.estimated_value_usd,
    closeProbability: row.close_probability,
    nextStep: row.next_step,
    nextStepDueAt: row.next_step_due_at,
    lastTouchAt: row.last_touch_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function opportunityToRow(entry: Opportunity): OpportunityRow {
  return {
    id: entry.id,
    lead_id: entry.leadId,
    contact_id: entry.contactId,
    service_key: entry.serviceKey,
    source_campaign_id: entry.sourceCampaignId,
    stage: entry.stage,
    status: entry.status,
    estimated_value_usd: entry.estimatedValueUsd,
    close_probability: entry.closeProbability,
    next_step: entry.nextStep,
    next_step_due_at: entry.nextStepDueAt,
    last_touch_at: entry.lastTouchAt,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function meetingFromRow(row: MeetingRow): Meeting {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    leadId: row.lead_id,
    contactId: row.contact_id,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    agenda: row.agenda,
    prepNotes: row.prep_notes,
    outcome: row.outcome,
    followUpDueAt: row.follow_up_due_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function meetingToRow(entry: Meeting): MeetingRow {
  return {
    id: entry.id,
    opportunity_id: entry.opportunityId,
    lead_id: entry.leadId,
    contact_id: entry.contactId,
    scheduled_at: entry.scheduledAt,
    duration_minutes: entry.durationMinutes,
    agenda: entry.agenda,
    prep_notes: entry.prepNotes,
    outcome: entry.outcome,
    follow_up_due_at: entry.followUpDueAt,
    status: entry.status,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function proposalTemplateFromRow(row: ProposalTemplateRow): ProposalTemplate {
  return {
    id: row.id,
    serviceKey: row.service_key,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function proposalTemplateToRow(entry: ProposalTemplate): ProposalTemplateRow {
  return {
    id: entry.id,
    service_key: entry.serviceKey,
    title_template: entry.titleTemplate,
    body_template: entry.bodyTemplate,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function proposalDocumentFromRow(row: ProposalDocumentRow): ProposalDocument {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    leadId: row.lead_id,
    contactId: row.contact_id,
    serviceKey: row.service_key,
    status: row.status,
    title: row.title,
    amountUsd: row.amount_usd,
    content: row.content,
    docUrl: row.doc_url,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    lostAt: row.lost_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function proposalDocumentToRow(entry: ProposalDocument): ProposalDocumentRow {
  return {
    id: entry.id,
    opportunity_id: entry.opportunityId,
    lead_id: entry.leadId,
    contact_id: entry.contactId,
    service_key: entry.serviceKey,
    status: entry.status,
    title: entry.title,
    amount_usd: entry.amountUsd,
    content: entry.content,
    doc_url: entry.docUrl,
    pdf_url: entry.pdfUrl,
    sent_at: entry.sentAt,
    accepted_at: entry.acceptedAt,
    lost_at: entry.lostAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    leadId: row.lead_id,
    primaryContactId: row.primary_contact_id,
    sourceOpportunityId: row.source_opportunity_id,
    status: row.status,
    startDate: row.start_date,
    retainerType: row.retainer_type,
    billingCycle: row.billing_cycle,
    notes: row.notes,
    driveFolderUrl: row.drive_folder_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientToRow(entry: Client): ClientRow {
  return {
    id: entry.id,
    lead_id: entry.leadId,
    primary_contact_id: entry.primaryContactId,
    source_opportunity_id: entry.sourceOpportunityId,
    status: entry.status,
    start_date: entry.startDate,
    retainer_type: entry.retainerType,
    billing_cycle: entry.billingCycle,
    notes: entry.notes,
    drive_folder_url: entry.driveFolderUrl,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function clientProjectFromRow(row: ClientProjectRow): ClientProject {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceKey: row.service_key,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    targetDate: row.target_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientProjectToRow(entry: ClientProject): ClientProjectRow {
  return {
    id: entry.id,
    client_id: entry.clientId,
    service_key: entry.serviceKey,
    name: entry.name,
    status: entry.status,
    start_date: entry.startDate,
    target_date: entry.targetDate,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function projectTaskFromRow(row: ProjectTaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    dueAt: row.due_at,
    notes: row.notes,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectTaskToRow(entry: ProjectTask): ProjectTaskRow {
  return {
    id: entry.id,
    project_id: entry.projectId,
    title: entry.title,
    status: entry.status,
    due_at: entry.dueAt,
    notes: entry.notes,
    sort_order: entry.sortOrder,
    completed_at: entry.completedAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function clientAssetFromRow(row: ClientAssetRow): ClientAsset {
  return {
    id: row.id,
    clientId: row.client_id,
    label: row.label,
    kind: row.kind,
    driveUrl: row.drive_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientAssetToRow(entry: ClientAsset): ClientAssetRow {
  return {
    id: entry.id,
    client_id: entry.clientId,
    label: entry.label,
    kind: entry.kind,
    drive_url: entry.driveUrl,
    status: entry.status,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function clientAssetRequestFromRow(row: ClientAssetRequestRow): ClientAssetRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    status: row.status,
    description: row.description,
    requestedAt: row.requested_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clientAssetRequestToRow(entry: ClientAssetRequest): ClientAssetRequestRow {
  return {
    id: entry.id,
    client_id: entry.clientId,
    type: entry.type,
    status: entry.status,
    description: entry.description,
    requested_at: entry.requestedAt,
    received_at: entry.receivedAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function reminderFromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    clientId: row.client_id,
    projectId: row.project_id,
    title: row.title,
    dueAt: row.due_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reminderToRow(entry: Reminder): ReminderRow {
  return {
    id: entry.id,
    lead_id: entry.leadId,
    opportunity_id: entry.opportunityId,
    client_id: entry.clientId,
    project_id: entry.projectId,
    title: entry.title,
    due_at: entry.dueAt,
    status: entry.status,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function activityNoteFromRow(row: ActivityNoteRow): ActivityNote {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    leadId: row.lead_id,
    clientId: row.client_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function activityNoteToRow(entry: ActivityNote): ActivityNoteRow {
  return {
    id: entry.id,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    lead_id: entry.leadId,
    client_id: entry.clientId,
    body: entry.body,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function serviceOfferProfileFromRow(row: ServiceOfferProfileRow): ServiceOfferProfile {
  return {
    id: row.id,
    serviceKey: row.service_key,
    label: row.label,
    scopeDefaults: row.scope_defaults,
    pricingNotes: row.pricing_notes,
    objectionNotes: row.objection_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serviceOfferProfileToRow(entry: ServiceOfferProfile): ServiceOfferProfileRow {
  return {
    id: entry.id,
    service_key: entry.serviceKey,
    label: entry.label,
    scope_defaults: entry.scopeDefaults,
    pricing_notes: entry.pricingNotes,
    objection_notes: entry.objectionNotes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function reportingConnectionFromRow(row: ReportingConnectionRow): ReportingConnection {
  return {
    id: row.id,
    clientId: row.client_id,
    kind: row.kind,
    target: row.target,
    status: row.status,
    settings: row.settings ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reportingConnectionToRow(entry: ReportingConnection): ReportingConnectionRow {
  return {
    id: entry.id,
    client_id: entry.clientId,
    kind: entry.kind,
    target: entry.target,
    status: entry.status,
    settings: entry.settings,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function monthlyReportFromRow(row: MonthlyReportRow): MonthlyReport {
  return {
    id: row.id,
    clientId: row.client_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    title: row.title,
    summary: row.summary,
    content: row.content,
    metricsSnapshot: row.metrics_snapshot ?? {},
    docUrl: row.doc_url,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function monthlyReportToRow(entry: MonthlyReport): MonthlyReportRow {
  return {
    id: entry.id,
    client_id: entry.clientId,
    period_start: entry.periodStart,
    period_end: entry.periodEnd,
    status: entry.status,
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    metrics_snapshot: entry.metricsSnapshot,
    doc_url: entry.docUrl,
    generated_at: entry.generatedAt,
    updated_at: entry.updatedAt,
  };
}

async function readSupabaseTable<Row>(tableName: string, optional = false) {
  const client = getSupabaseAdminClient();
  const result = await client.from(tableName).select("*");

  return (expectSupabaseData(result.error, result.data, { optional }) as Row[] | null) ?? [];
}

async function readSupabaseDb() {
  const [
    leadRows,
    leadCrmMetadataRows,
    contactRows,
    runRows,
    searchJobRows,
    enrichmentJobRows,
    serviceProfileRows,
    auditJobRows,
    auditFindingRows,
    prospectVariableRows,
    sequenceTemplateRows,
    campaignRows,
    campaignStepRows,
    campaignLeadRows,
    generatedSequenceRows,
    mailboxRows,
    emailThreadRows,
    emailMessageRows,
    outreachStateRows,
    suppressionEntryRows,
    opportunityRows,
    meetingRows,
    proposalTemplateRows,
    proposalDocumentRows,
    clientRows,
    clientProjectRows,
    projectTaskRows,
    clientAssetRows,
    clientAssetRequestRows,
    reminderRows,
    activityNoteRows,
    serviceOfferProfileRows,
    reportingConnectionRows,
    monthlyReportRows,
  ] = await Promise.all([
    readSupabaseTable<LeadRow>(salesMachineTables.leads),
    readSupabaseTable<LeadCrmMetadataRow>(salesMachineTables.leadCrmMetadata, true),
    readSupabaseTable<ContactRow>(salesMachineTables.contacts),
    readSupabaseTable<WorkflowRunRow>(salesMachineTables.runs),
    readSupabaseTable<SearchJobRow>(salesMachineTables.searchJobs),
    readSupabaseTable<EnrichmentJobRow>(salesMachineTables.enrichmentJobs),
    readSupabaseTable<ServiceProfileRow>(salesMachineTables.serviceProfiles, true),
    readSupabaseTable<WebsiteAuditJobRow>(salesMachineTables.auditJobs, true),
    readSupabaseTable<WebsiteAuditFindingRow>(salesMachineTables.auditFindings, true),
    readSupabaseTable<ProspectVariableSetRow>(salesMachineTables.prospectVariables, true),
    readSupabaseTable<SequenceTemplateRow>(salesMachineTables.sequenceTemplates, true),
    readSupabaseTable<CampaignRow>(salesMachineTables.campaigns, true),
    readSupabaseTable<CampaignStepRow>(salesMachineTables.campaignSteps, true),
    readSupabaseTable<CampaignLeadRow>(salesMachineTables.campaignLeads, true),
    readSupabaseTable<GeneratedSequenceRow>(salesMachineTables.generatedSequences, true),
    readSupabaseTable<ConnectedMailboxRow>(salesMachineTables.connectedMailboxes, true),
    readSupabaseTable<EmailThreadRow>(salesMachineTables.emailThreads, true),
    readSupabaseTable<EmailMessageRow>(salesMachineTables.emailMessages, true),
    readSupabaseTable<ProspectOutreachStateRow>(salesMachineTables.outreachStates, true),
    readSupabaseTable<SuppressionEntryRow>(salesMachineTables.suppressionEntries, true),
    readSupabaseTable<OpportunityRow>(salesMachineTables.opportunities, true),
    readSupabaseTable<MeetingRow>(salesMachineTables.meetings, true),
    readSupabaseTable<ProposalTemplateRow>(salesMachineTables.proposalTemplates, true),
    readSupabaseTable<ProposalDocumentRow>(salesMachineTables.proposalDocuments, true),
    readSupabaseTable<ClientRow>(salesMachineTables.clients, true),
    readSupabaseTable<ClientProjectRow>(salesMachineTables.clientProjects, true),
    readSupabaseTable<ProjectTaskRow>(salesMachineTables.projectTasks, true),
    readSupabaseTable<ClientAssetRow>(salesMachineTables.clientAssets, true),
    readSupabaseTable<ClientAssetRequestRow>(salesMachineTables.clientAssetRequests, true),
    readSupabaseTable<ReminderRow>(salesMachineTables.reminders, true),
    readSupabaseTable<ActivityNoteRow>(salesMachineTables.activityNotes, true),
    readSupabaseTable<ServiceOfferProfileRow>(salesMachineTables.serviceOfferProfiles, true),
    readSupabaseTable<ReportingConnectionRow>(salesMachineTables.reportingConnections, true),
    readSupabaseTable<MonthlyReportRow>(salesMachineTables.monthlyReports, true),
  ]);

  const remoteDb = ensureArrays({
    leads: leadRows.map(leadFromRow),
    leadCrmMetadata: leadCrmMetadataRows.map(leadCrmMetadataFromRow),
    contacts: contactRows.map(contactFromRow),
    runs: runRows.map(runFromRow),
    searchJobs: searchJobRows.map(searchJobFromRow),
    enrichmentJobs: enrichmentJobRows.map(enrichmentJobFromRow),
    serviceProfiles: serviceProfileRows.map(serviceProfileFromRow),
    auditJobs: auditJobRows.map(auditJobFromRow),
    auditFindings: auditFindingRows.map(auditFindingFromRow),
    prospectVariables: prospectVariableRows.map(prospectVariableFromRow),
    sequenceTemplates: sequenceTemplateRows.map(sequenceTemplateFromRow),
    campaigns: campaignRows.map(campaignFromRow),
    campaignSteps: campaignStepRows.map(campaignStepFromRow),
    campaignLeads: campaignLeadRows.map(campaignLeadFromRow),
    generatedSequences: generatedSequenceRows.map(generatedSequenceFromRow),
    connectedMailboxes: mailboxRows.map(mailboxFromRow),
    emailThreads: emailThreadRows.map(emailThreadFromRow),
    emailMessages: emailMessageRows.map(emailMessageFromRow),
    outreachStates: outreachStateRows.map(outreachStateFromRow),
    suppressionEntries: suppressionEntryRows.map(suppressionEntryFromRow),
    opportunities: opportunityRows.map(opportunityFromRow),
    meetings: meetingRows.map(meetingFromRow),
    proposalTemplates: proposalTemplateRows.map(proposalTemplateFromRow),
    proposalDocuments: proposalDocumentRows.map(proposalDocumentFromRow),
    clients: clientRows.map(clientFromRow),
    clientProjects: clientProjectRows.map(clientProjectFromRow),
    projectTasks: projectTaskRows.map(projectTaskFromRow),
    clientAssets: clientAssetRows.map(clientAssetFromRow),
    clientAssetRequests: clientAssetRequestRows.map(clientAssetRequestFromRow),
    reminders: reminderRows.map(reminderFromRow),
    activityNotes: activityNoteRows.map(activityNoteFromRow),
    serviceOfferProfiles: serviceOfferProfileRows.map(serviceOfferProfileFromRow),
    reportingConnections: reportingConnectionRows.map(reportingConnectionFromRow),
    monthlyReports: monthlyReportRows.map(monthlyReportFromRow),
  });

  const localDb = await readLocalDb().catch(() => ensureArrays(undefined));

  return ensureArrays({
    ...remoteDb,
    leadCrmMetadata: mergeById(remoteDb.leadCrmMetadata, localDb.leadCrmMetadata),
    runs: mergeById(remoteDb.runs, localDb.runs),
    serviceProfiles: mergeById(remoteDb.serviceProfiles, localDb.serviceProfiles),
    auditJobs: mergeById(remoteDb.auditJobs, localDb.auditJobs),
    auditFindings: mergeById(remoteDb.auditFindings, localDb.auditFindings),
    prospectVariables: mergeById(remoteDb.prospectVariables, localDb.prospectVariables),
    sequenceTemplates: mergeById(remoteDb.sequenceTemplates, localDb.sequenceTemplates),
    campaigns: mergeById(remoteDb.campaigns, localDb.campaigns),
    campaignSteps: mergeById(remoteDb.campaignSteps, localDb.campaignSteps),
    campaignLeads: mergeById(remoteDb.campaignLeads, localDb.campaignLeads),
    generatedSequences: mergeById(remoteDb.generatedSequences, localDb.generatedSequences),
    connectedMailboxes: mergeById(remoteDb.connectedMailboxes, localDb.connectedMailboxes),
    emailThreads: mergeById(remoteDb.emailThreads, localDb.emailThreads),
    emailMessages: mergeById(remoteDb.emailMessages, localDb.emailMessages),
    outreachStates: mergeById(remoteDb.outreachStates, localDb.outreachStates),
    suppressionEntries: mergeById(remoteDb.suppressionEntries, localDb.suppressionEntries),
    opportunities: mergeById(remoteDb.opportunities, localDb.opportunities),
    meetings: mergeById(remoteDb.meetings, localDb.meetings),
    proposalTemplates: mergeById(remoteDb.proposalTemplates, localDb.proposalTemplates),
    proposalDocuments: mergeById(remoteDb.proposalDocuments, localDb.proposalDocuments),
    clients: mergeById(remoteDb.clients, localDb.clients),
    clientProjects: mergeById(remoteDb.clientProjects, localDb.clientProjects),
    projectTasks: mergeById(remoteDb.projectTasks, localDb.projectTasks),
    clientAssets: mergeById(remoteDb.clientAssets, localDb.clientAssets),
    clientAssetRequests: mergeById(remoteDb.clientAssetRequests, localDb.clientAssetRequests),
    reminders: mergeById(remoteDb.reminders, localDb.reminders),
    activityNotes: mergeById(remoteDb.activityNotes, localDb.activityNotes),
    serviceOfferProfiles: mergeById(remoteDb.serviceOfferProfiles, localDb.serviceOfferProfiles),
    reportingConnections: mergeById(remoteDb.reportingConnections, localDb.reportingConnections),
    monthlyReports: mergeById(remoteDb.monthlyReports, localDb.monthlyReports),
  });
}

function isOutreachStorageFallbackError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("run supabase/schema.sql") ||
    message.includes("sales_machine_runs_kind_check") ||
    message.includes("violates check constraint")
  );
}

async function syncTable<Row extends { id: string }>(
  tableName: string,
  beforeRows: ReadonlyArray<{ id: string }>,
  afterRows: Row[],
  options?: { onMissing?: "skip" | "error" },
) {
  const client = getSupabaseAdminClient();

  if (afterRows.length > 0) {
    const { error } = await client.from(tableName).upsert(afterRows, {
      onConflict: "id",
    });

    if (error) {
      if (options?.onMissing && isMissingSupabaseTableError(error)) {
        if (options.onMissing === "skip") {
          return;
        }

        throw new Error(
          `Supabase table ${tableName} is missing. Run supabase/schema.sql before using outreach features.`,
        );
      }

      throw new Error(error.message);
    }
  }

  const afterIds = new Set(afterRows.map((row) => row.id));
  const removedIds = beforeRows.map((row) => row.id).filter((id) => !afterIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await client.from(tableName).delete().in("id", removedIds);

    if (error) {
      if (options?.onMissing && isMissingSupabaseTableError(error)) {
        if (options.onMissing === "skip") {
          return;
        }

        throw new Error(
          `Supabase table ${tableName} is missing. Run supabase/schema.sql before using outreach features.`,
        );
      }

      throw new Error(error.message);
    }
  }
}

async function writeSupabaseDb(before: SalesMachineDb, after: SalesMachineDb) {
  await syncTable(
    salesMachineTables.leads,
    before.leads,
    after.leads.map(leadToRow),
  );
  await syncTable(
    salesMachineTables.leadCrmMetadata,
    before.leadCrmMetadata,
    after.leadCrmMetadata.map(leadCrmMetadataToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.contacts,
    before.contacts,
    after.contacts.map(contactToRow),
  );
  await syncTable(
    salesMachineTables.runs,
    before.runs.filter((run) => isSupabaseNativeRunKind(run.kind)),
    after.runs
      .filter((run) => isSupabaseNativeRunKind(run.kind))
      .map(runToRow),
  );
  await syncTable(
    salesMachineTables.searchJobs,
    before.searchJobs,
    after.searchJobs.map(searchJobToRow),
  );
  await syncTable(
    salesMachineTables.enrichmentJobs,
    before.enrichmentJobs,
    after.enrichmentJobs.map(enrichmentJobToRow),
  );
  await syncTable(
    salesMachineTables.serviceProfiles,
    before.serviceProfiles,
    after.serviceProfiles.map(serviceProfileToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.auditJobs,
    before.auditJobs,
    after.auditJobs.map(auditJobToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.auditFindings,
    before.auditFindings,
    after.auditFindings.map(auditFindingToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.prospectVariables,
    before.prospectVariables,
    after.prospectVariables.map(prospectVariableToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.sequenceTemplates,
    before.sequenceTemplates,
    after.sequenceTemplates.map(sequenceTemplateToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.campaigns,
    before.campaigns,
    after.campaigns.map(campaignToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.campaignSteps,
    before.campaignSteps,
    after.campaignSteps.map(campaignStepToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.campaignLeads,
    before.campaignLeads,
    after.campaignLeads.map(campaignLeadToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.generatedSequences,
    before.generatedSequences,
    after.generatedSequences.map(generatedSequenceToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.connectedMailboxes,
    before.connectedMailboxes,
    after.connectedMailboxes.map(mailboxToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.emailThreads,
    before.emailThreads,
    after.emailThreads.map(emailThreadToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.emailMessages,
    before.emailMessages,
    after.emailMessages.map(emailMessageToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.outreachStates,
    before.outreachStates,
    after.outreachStates.map(outreachStateToRow),
    { onMissing: "error" },
  );
  await syncTable(
    salesMachineTables.suppressionEntries,
    before.suppressionEntries,
    after.suppressionEntries.map(suppressionEntryToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.opportunities,
    before.opportunities,
    after.opportunities.map(opportunityToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.meetings,
    before.meetings,
    after.meetings.map(meetingToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.proposalTemplates,
    before.proposalTemplates,
    after.proposalTemplates.map(proposalTemplateToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.proposalDocuments,
    before.proposalDocuments,
    after.proposalDocuments.map(proposalDocumentToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.clients,
    before.clients,
    after.clients.map(clientToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.clientProjects,
    before.clientProjects,
    after.clientProjects.map(clientProjectToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.projectTasks,
    before.projectTasks,
    after.projectTasks.map(projectTaskToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.clientAssets,
    before.clientAssets,
    after.clientAssets.map(clientAssetToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.clientAssetRequests,
    before.clientAssetRequests,
    after.clientAssetRequests.map(clientAssetRequestToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.reminders,
    before.reminders,
    after.reminders.map(reminderToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.activityNotes,
    before.activityNotes,
    after.activityNotes.map(activityNoteToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.serviceOfferProfiles,
    before.serviceOfferProfiles,
    after.serviceOfferProfiles.map(serviceOfferProfileToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.reportingConnections,
    before.reportingConnections,
    after.reportingConnections.map(reportingConnectionToRow),
    { onMissing: "skip" },
  );
  await syncTable(
    salesMachineTables.monthlyReports,
    before.monthlyReports,
    after.monthlyReports.map(monthlyReportToRow),
    { onMissing: "skip" },
  );
}

export async function readDb() {
  if (getStorageMode() === "supabase") {
    return readSupabaseDb();
  }

  return readLocalDb();
}

export async function mutateDb<T>(mutator: (db: SalesMachineDb) => Promise<T> | T) {
  const task = mutationQueue.then(async () => {
    const before = await readDb();
    const next = structuredClone(before) as SalesMachineDb;
    ensureOutreachSeedData(next);
    const result = await mutator(next);

    if (getStorageMode() === "supabase") {
      try {
        await writeSupabaseDb(before, next);
        await writeLocalDb(next);
      } catch (error) {
        if (!isOutreachStorageFallbackError(error)) {
          throw error;
        }

        await writeLocalDb(next);
      }
    } else {
      await writeLocalDb(next);
    }

    return result;
  });

  mutationQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

function computeCampaignMetrics(db: SalesMachineDb): CampaignMetrics[] {
  return db.campaigns.map((campaign) => {
    const leads = db.campaignLeads.filter((candidate) => candidate.campaignId === campaign.id);
    const sequences = db.generatedSequences.filter((candidate) => candidate.campaignId === campaign.id);

    return {
      campaignId: campaign.id,
      leadCount: leads.length,
      draftedCount: leads.filter((candidate) => candidate.status === "drafted").length,
      approvedCount: sequences.filter((candidate) => candidate.state === "approved").length,
      scheduledCount: sequences.filter((candidate) => candidate.state === "scheduled").length,
      sentCount: sequences.filter((candidate) => candidate.state === "sent").length,
      repliedCount: leads.filter((candidate) => candidate.status === "replied").length,
      bookedCount: leads.filter((candidate) => candidate.status === "booked").length,
      nurtureCount: leads.filter((candidate) => candidate.status === "nurture").length,
      closedCount: leads.filter((candidate) => candidate.status === "closed").length,
      needsEscalationCount: leads.filter((candidate) => candidate.status === "needs_escalation")
        .length,
    };
  });
}

export async function getDashboardSnapshot(
  providerStatuses: DashboardSnapshot["providerStatuses"],
) {
  const db = await readDb();
  const billingOverview = await getBillingOverview({
    runs: db.runs,
  });

  const leads = [...db.leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const contacts = [...db.contacts].sort((a, b) =>
    b.discoveredAt.localeCompare(a.discoveredAt),
  );
  const runs = [...db.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const emailThreads = [...db.emailThreads].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  );

  return {
    leads,
    contacts,
    runs,
    emailThreads,
    providerStatuses,
    billingOverview,
    stats: {
      leadCount: db.leads.length,
      enrichedLeadCount: db.leads.filter((lead) => lead.stage === "enriched").length,
      contactCount: db.contacts.length,
      failedLeadCount: db.leads.filter((lead) => lead.stage === "error").length,
    },
    outreachStats: {
      auditJobCount: db.auditJobs.length,
      sequencesReadyCount: db.generatedSequences.filter((sequence) => sequence.state === "drafted")
        .length,
      repliedCount: db.outreachStates.filter((state) => state.state === "replied").length,
      bookedCount: db.outreachStates.filter((state) => state.state === "booked").length,
      nurtureCount: db.outreachStates.filter((state) => state.state === "nurture").length,
    },
  } satisfies DashboardSnapshot;
}

export async function getOutreachSnapshot(): Promise<OutreachSnapshot> {
  const db = await readDb();
  const leads = [...db.leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const leadCrmMetadata = [...db.leadCrmMetadata].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const contacts = [...db.contacts].sort((a, b) =>
    b.discoveredAt.localeCompare(a.discoveredAt),
  );
  const runs = [...db.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const auditJobs = [...db.auditJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auditFindings = [...db.auditFindings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const campaigns = [...db.campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const campaignSteps = [...db.campaignSteps].sort((a, b) => {
    if (a.campaignId === b.campaignId) {
      return a.stepNumber - b.stepNumber;
    }

    return a.campaignId.localeCompare(b.campaignId);
  });
  const campaignLeads = [...db.campaignLeads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const campaignMetrics = computeCampaignMetrics(db).sort((a, b) => b.leadCount - a.leadCount);
  const generatedSequences = [...db.generatedSequences].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const emailThreads = [...db.emailThreads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const opportunities = [...db.opportunities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const meetings = [...db.meetings].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const proposalDocuments = [...db.proposalDocuments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const clients = [...db.clients].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const clientProjects = [...db.clientProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projectTasks = [...db.projectTasks].sort((a, b) => {
    if (a.projectId === b.projectId) {
      return a.sortOrder - b.sortOrder;
    }

    return a.projectId.localeCompare(b.projectId);
  });
  const reminders = [...db.reminders].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const activityNotes = [...db.activityNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const monthlyReports = [...db.monthlyReports].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const sheets = buildWorkspaceSheets({
    leads,
    contacts,
    runs,
  }).map((sheet) => ({
    key: sheet.key,
    label: sheet.label,
    niche: sheet.niche,
    location: sheet.location,
  }));

  return {
    leads,
    leadCrmMetadata,
    contacts,
    runs,
    serviceProfiles: [...db.serviceProfiles].sort((a, b) => a.label.localeCompare(b.label)),
    auditJobs,
    auditFindings,
    prospectVariables: [...db.prospectVariables].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
    sequenceTemplates: [...db.sequenceTemplates].sort((a, b) => {
      if (a.serviceKey === b.serviceKey) {
        return a.stepNumber - b.stepNumber;
      }

      return a.serviceKey.localeCompare(b.serviceKey);
    }),
    campaigns,
    campaignSteps,
    campaignLeads,
    campaignMetrics,
    generatedSequences,
    connectedMailboxes: [...db.connectedMailboxes].sort((a, b) =>
      a.email.localeCompare(b.email),
    ),
    emailThreads,
    emailMessages: [...db.emailMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    outreachStates: [...db.outreachStates].sort((a, b) =>
      b.lastActivityAt.localeCompare(a.lastActivityAt),
    ),
    suppressionEntries: [...db.suppressionEntries].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    opportunities,
    meetings,
    proposalTemplates: [...db.proposalTemplates].sort((a, b) =>
      a.serviceKey.localeCompare(b.serviceKey),
    ),
    proposalDocuments,
    clients,
    clientProjects,
    projectTasks,
    clientAssets: [...db.clientAssets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    clientAssetRequests: [...db.clientAssetRequests].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
    reminders,
    activityNotes,
    serviceOfferProfiles: [...db.serviceOfferProfiles].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    reportingConnections: [...db.reportingConnections].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
    monthlyReports,
    sheets,
    stats: {
      auditJobCount: auditJobs.length,
      findingsCount: auditFindings.length,
      sequencesReadyCount: generatedSequences.filter((sequence) => sequence.state === "drafted")
        .length,
      repliedCount: db.outreachStates.filter((state) => state.state === "replied").length,
      bookedCount: db.outreachStates.filter((state) => state.state === "booked").length,
      nurtureCount: db.outreachStates.filter((state) => state.state === "nurture").length,
      closedCount: db.outreachStates.filter((state) => state.state === "closed").length,
    },
  };
}
