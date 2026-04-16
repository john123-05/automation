import type { BillingOverview } from "@/lib/billing/types";

export type LeadStage = "discovered" | "enriched" | "contact_missing" | "error";

export type RunKind =
  | "lead-search"
  | "contact-enrichment"
  | "website-audit"
  | "sequence-generation"
  | "message-send"
  | "inbox-sync";

export type RunStatus = "running" | "completed" | "failed";

export type StepStatus = "running" | "completed" | "failed";

export type JobStatus = "running" | "completed" | "failed";

export type AiResearchProvider = "openai:web_search" | "gemini:google_search" | "claude:web_search";

export type ServiceKey =
  | "seo"
  | "webdesign"
  | "copywriting"
  | "ai_automation"
  | "marketing"
  | "lead_capture";

export type LeadPriority = "low" | "medium" | "high";

export type LeadNextAction =
  | "review_audit"
  | "approve_sequence"
  | "send_now"
  | "reply"
  | "book_meeting"
  | "follow_up_later";

export type AuditScope = "run" | "sheet" | "all";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignLeadStatus = "audited" | OutreachStateStatus;

export type AuditIssueType =
  | "missing_sitemap"
  | "missing_meta_description"
  | "missing_h1"
  | "missing_canonical"
  | "missing_cta"
  | "missing_contact_path"
  | "weak_headline"
  | "weak_offer"
  | "weak_social_proof"
  | "low_page_depth"
  | "manual_process_signal"
  | "site_unreachable"
  | "generic_opportunity";

export type ProspectVariableBag = Record<string, string | boolean | null>;

export type OutreachStateStatus =
  | "drafted"
  | "approved"
  | "scheduled"
  | "sent"
  | "replied"
  | "booked"
  | "nurture"
  | "closed"
  | "needs_escalation"
  | "no_show";

export type MailboxProvider = "gmail" | "smtp";

export type MailboxStatus = "setup_needed" | "connected" | "error";

export type EmailMessageDirection = "outbound" | "inbound";

export type EmailMessageStatus = "draft" | "sent" | "received" | "failed";

export type OpportunityStage =
  | "new"
  | "qualified"
  | "meeting_booked"
  | "proposal_drafted"
  | "proposal_sent"
  | "won"
  | "lost"
  | "nurture";

export type OpportunityStatus = "open" | "won" | "lost" | "nurture";

export type MeetingStatus = "planned" | "completed" | "no_show" | "cancelled";

export type ProposalStatus = "draft" | "sent" | "accepted" | "lost";

export type ClientStatus = "active" | "paused" | "completed";

export type RetainerType = "one_off" | "monthly" | "quarterly" | "project";

export type ProjectStatus = "planned" | "active" | "blocked" | "completed";

export type ProjectTaskStatus = "todo" | "in_progress" | "done";

export type ClientAssetStatus = "expected" | "uploaded" | "approved";

export type ClientAssetRequestStatus = "requested" | "received" | "cancelled";

export type ReminderStatus = "open" | "done" | "snoozed";

export type ActivityEntityType = "lead" | "opportunity" | "client" | "project";

export type ReportingConnectionKind = "search_console" | "ga4" | "pagespeed";

export type ReportingConnectionStatus = "setup_needed" | "connected" | "error";

export type MonthlyReportStatus = "draft" | "ready" | "sent";

export type TrashEntityType =
  | "lead"
  | "contact"
  | "sheet"
  | "run"
  | "campaign"
  | "opportunity"
  | "proposal"
  | "client"
  | "project"
  | "report";

export type OpenAiRunSpend = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  estimatedCostUsd: number;
  recordedAt: string;
};

export type Lead = {
  id: string;
  companyName: string;
  address: string;
  websiteUri: string | null;
  rating: number | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  niche: string;
  locationLabel: string;
  source: "google-places" | "manual-entry" | "csv-import";
  stage: LeadStage;
  personSearched: boolean;
  contactCount: number;
  researchSummary: string | null;
  lastError: string | null;
  searchRunId: string | null;
  discoveredAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  leadId: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedin: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  confidence: "high" | "medium" | "low";
  source: "openai-web-search" | "manual-entry" | "csv-import";
  discoveredAt: string;
};

export type LeadCrmMetadata = {
  id: string;
  leadId: string;
  notes: string | null;
  priority: LeadPriority;
  nextAction: LeadNextAction | null;
  nextActionDueAt: string | null;
  ownerLabel: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type WorkflowStep = {
  id: string;
  label: string;
  status: StepStatus;
  startedAt: string;
  finishedAt: string | null;
  message: string;
  details: string | null;
};

export type WorkflowRun = {
  id: string;
  kind: RunKind;
  status: RunStatus;
  input: Record<string, unknown> & {
    openAiSpend?: OpenAiRunSpend | null;
    claudeSpend?: OpenAiRunSpend | null;
  };
  summary: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: WorkflowStep[];
};

export type SearchJob = {
  id: string;
  runId: string;
  niche: string;
  locationLabel: string;
  radiusMeters: number;
  targetMaxLeads: number;
  status: JobStatus;
  nextPageToken: string | null;
  pagesFetched: number;
  leadsCollected: number;
  warnings: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type EnrichmentJob = {
  id: string;
  runId: string;
  batchSize: number;
  providerOrder: AiResearchProvider[];
  status: JobStatus;
  leadsClaimed: number;
  leadsProcessed: number;
  enrichedCount: number;
  missingCount: number;
  failedCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type ServiceProfile = {
  id: string;
  serviceKey: ServiceKey;
  label: string;
  shortDescription: string;
  auditRules: string[];
  createdAt: string;
  updatedAt: string;
};

export type WebsiteAuditJob = {
  id: string;
  campaignId: string | null;
  runId: string;
  serviceKey: ServiceKey;
  scope: AuditScope;
  sourceRunId: string | null;
  sheetKey: string | null;
  batchSize: number;
  status: JobStatus;
  leadsClaimed: number;
  leadsProcessed: number;
  findingsCreated: number;
  failedCount: number;
  currentLeadId: string | null;
  currentLeadName: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type WebsiteAuditFinding = {
  id: string;
  leadId: string;
  serviceKey: ServiceKey;
  jobId: string;
  issueType: AuditIssueType;
  pageUrl: string | null;
  pageLabel: string | null;
  summary: string;
  recognizableReason: string;
  consequenceMechanics: string;
  reviewTime: string;
  microYes: string;
  previewAssetExists: boolean;
  evidence: string[];
  rawSignals: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProspectVariableSet = {
  id: string;
  leadId: string;
  serviceKey: ServiceKey;
  findingId: string;
  contactId: string | null;
  variables: ProspectVariableBag;
  createdAt: string;
  updatedAt: string;
};

export type SequenceTemplate = {
  id: string;
  serviceKey: ServiceKey;
  stepNumber: 1 | 2 | 3 | 4;
  dayOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedSequenceStep = {
  stepNumber: 1 | 2 | 3 | 4;
  dayOffset: number;
  subject: string;
  body: string;
  approvalState: "pending" | "approved";
  sendState: "draft" | "scheduled" | "sent" | "failed";
  scheduledFor: string | null;
  sentAt: string | null;
};

export type GeneratedSequence = {
  id: string;
  campaignId: string | null;
  leadId: string;
  serviceKey: ServiceKey;
  findingId: string;
  variablesId: string;
  mailboxId: string | null;
  state: OutreachStateStatus;
  steps: GeneratedSequenceStep[];
  generatedAt: string;
  approvedAt: string | null;
  updatedAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  serviceKey: ServiceKey;
  status: CampaignStatus;
  sourceScope: AuditScope;
  sourceRunId: string | null;
  sheetKey: string | null;
  mailboxId: string | null;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  allowedWeekdays: number[];
  stopOnReply: boolean;
  waitHoursAfterFinalStep: number;
  createdAt: string;
  updatedAt: string;
};

export type CampaignStep = {
  id: string;
  campaignId: string;
  stepNumber: 1 | 2 | 3 | 4;
  dayOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampaignLead = {
  id: string;
  campaignId: string;
  leadId: string;
  contactId: string | null;
  findingId: string | null;
  variablesId: string | null;
  sequenceId: string | null;
  outreachStateId: string | null;
  status: CampaignLeadStatus;
  createdAt: string;
  updatedAt: string;
};

export type CampaignMetrics = {
  campaignId: string;
  leadCount: number;
  draftedCount: number;
  approvedCount: number;
  scheduledCount: number;
  sentCount: number;
  repliedCount: number;
  bookedCount: number;
  nurtureCount: number;
  closedCount: number;
  needsEscalationCount: number;
};

export type ConnectedMailbox = {
  id: string;
  provider: MailboxProvider;
  email: string;
  displayName: string | null;
  status: MailboxStatus;
  signature: string | null;
  dailyLimit: number | null;
  oauthData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EmailThread = {
  id: string;
  campaignId: string | null;
  mailboxId: string;
  leadId: string | null;
  serviceKey: ServiceKey | null;
  sequenceId: string | null;
  externalThreadId: string | null;
  subject: string;
  snippet: string | null;
  contactName: string | null;
  contactEmail: string | null;
  state: OutreachStateStatus;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EmailMessage = {
  id: string;
  threadId: string;
  mailboxId: string;
  externalMessageId: string | null;
  direction: EmailMessageDirection;
  status: EmailMessageStatus;
  subject: string;
  bodyText: string;
  fromAddress: string | null;
  toAddress: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type ProspectOutreachState = {
  id: string;
  campaignId: string | null;
  leadId: string;
  serviceKey: ServiceKey;
  mailboxId: string | null;
  sequenceId: string | null;
  threadId: string | null;
  state: OutreachStateStatus;
  nextStepNumber: number | null;
  notes: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SuppressionEntry = {
  id: string;
  email: string | null;
  domain: string | null;
  reason: string;
  source: "manual" | "bounce" | "reply" | "system";
  createdAt: string;
};

export type Opportunity = {
  id: string;
  leadId: string;
  contactId: string | null;
  serviceKey: ServiceKey;
  sourceCampaignId: string | null;
  stage: OpportunityStage;
  status: OpportunityStatus;
  estimatedValueUsd: number | null;
  closeProbability: number | null;
  nextStep: string | null;
  nextStepDueAt: string | null;
  lastTouchAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Meeting = {
  id: string;
  opportunityId: string | null;
  leadId: string;
  contactId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  agenda: string | null;
  prepNotes: string | null;
  outcome: string | null;
  followUpDueAt: string | null;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProposalTemplate = {
  id: string;
  serviceKey: ServiceKey;
  titleTemplate: string;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
};

export type ProposalDocument = {
  id: string;
  opportunityId: string;
  leadId: string;
  contactId: string | null;
  serviceKey: ServiceKey;
  status: ProposalStatus;
  title: string;
  amountUsd: number | null;
  content: string;
  docUrl: string | null;
  pdfUrl: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  leadId: string;
  primaryContactId: string | null;
  sourceOpportunityId: string | null;
  status: ClientStatus;
  startDate: string | null;
  retainerType: RetainerType;
  billingCycle: string | null;
  notes: string | null;
  driveFolderUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientProject = {
  id: string;
  clientId: string;
  serviceKey: ServiceKey;
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  status: ProjectTaskStatus;
  dueAt: string | null;
  notes: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientAsset = {
  id: string;
  clientId: string;
  label: string;
  kind: string;
  driveUrl: string | null;
  status: ClientAssetStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientAssetRequest = {
  id: string;
  clientId: string;
  type: string;
  status: ClientAssetRequestStatus;
  description: string | null;
  requestedAt: string;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Reminder = {
  id: string;
  leadId: string | null;
  opportunityId: string | null;
  clientId: string | null;
  projectId: string | null;
  title: string;
  dueAt: string;
  status: ReminderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityNote = {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  leadId: string | null;
  clientId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOfferProfile = {
  id: string;
  serviceKey: ServiceKey;
  label: string;
  scopeDefaults: string;
  pricingNotes: string | null;
  objectionNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportingConnection = {
  id: string;
  clientId: string;
  kind: ReportingConnectionKind;
  target: string;
  status: ReportingConnectionStatus;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyReport = {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: MonthlyReportStatus;
  title: string;
  summary: string;
  content: string;
  metricsSnapshot: Record<string, unknown>;
  docUrl: string | null;
  generatedAt: string;
  updatedAt: string;
};

export type TrashPayload = {
  leads?: Lead[];
  leadCrmMetadata?: LeadCrmMetadata[];
  contacts?: Contact[];
  runs?: WorkflowRun[];
  searchJobs?: SearchJob[];
  enrichmentJobs?: EnrichmentJob[];
  auditJobs?: WebsiteAuditJob[];
  auditFindings?: WebsiteAuditFinding[];
  prospectVariables?: ProspectVariableSet[];
  campaigns?: Campaign[];
  campaignSteps?: CampaignStep[];
  campaignLeads?: CampaignLead[];
  generatedSequences?: GeneratedSequence[];
  emailThreads?: EmailThread[];
  emailMessages?: EmailMessage[];
  outreachStates?: ProspectOutreachState[];
  opportunities?: Opportunity[];
  meetings?: Meeting[];
  proposalDocuments?: ProposalDocument[];
  clients?: Client[];
  clientProjects?: ClientProject[];
  projectTasks?: ProjectTask[];
  clientAssets?: ClientAsset[];
  clientAssetRequests?: ClientAssetRequest[];
  reminders?: Reminder[];
  activityNotes?: ActivityNote[];
  reportingConnections?: ReportingConnection[];
  monthlyReports?: MonthlyReport[];
};

export type TrashEntry = {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  label: string;
  summary: string;
  deletedAt: string;
  expiresAt: string;
  payload: TrashPayload;
};

export type SalesMachineDb = {
  leads: Lead[];
  leadCrmMetadata: LeadCrmMetadata[];
  contacts: Contact[];
  runs: WorkflowRun[];
  searchJobs: SearchJob[];
  enrichmentJobs: EnrichmentJob[];
  serviceProfiles: ServiceProfile[];
  auditJobs: WebsiteAuditJob[];
  auditFindings: WebsiteAuditFinding[];
  prospectVariables: ProspectVariableSet[];
  sequenceTemplates: SequenceTemplate[];
  campaigns: Campaign[];
  campaignSteps: CampaignStep[];
  campaignLeads: CampaignLead[];
  generatedSequences: GeneratedSequence[];
  connectedMailboxes: ConnectedMailbox[];
  emailThreads: EmailThread[];
  emailMessages: EmailMessage[];
  outreachStates: ProspectOutreachState[];
  suppressionEntries: SuppressionEntry[];
  opportunities: Opportunity[];
  meetings: Meeting[];
  proposalTemplates: ProposalTemplate[];
  proposalDocuments: ProposalDocument[];
  clients: Client[];
  clientProjects: ClientProject[];
  projectTasks: ProjectTask[];
  clientAssets: ClientAsset[];
  clientAssetRequests: ClientAssetRequest[];
  reminders: Reminder[];
  activityNotes: ActivityNote[];
  serviceOfferProfiles: ServiceOfferProfile[];
  reportingConnections: ReportingConnection[];
  monthlyReports: MonthlyReport[];
  trashEntries: TrashEntry[];
};

export type LeadSearchInput = {
  niche: string;
  location: string;
  radiusMeters: number;
  maxLeads: number;
  searchMode: "capped" | "exhaustive";
};

export type ContactEnrichmentInput = {
  batchSize: number;
  includePreviouslyFailed: boolean;
  allowOpenAiSecondPass: boolean;
  scope: "run" | "all-pending";
  sourceRunId: string | null;
};

export type AuditRunInput = {
  serviceKey: ServiceKey;
  scope: AuditScope;
  sourceRunId: string | null;
  sheetKey: string | null;
  batchSize: number;
  campaignId?: string | null;
};

export type SequenceGenerationInput = {
  serviceKey: ServiceKey;
  scope: AuditScope;
  sourceRunId: string | null;
  sheetKey: string | null;
  mailboxId: string | null;
  onlyUnsequenced: boolean;
  campaignId?: string | null;
};

export type SearchLeadResult = {
  runId: string;
  inserted: number;
  updated: number;
  totalFound: number;
};

export type ContactEnrichmentResult = {
  runId: string;
  processed: number;
  enriched: number;
  missing: number;
  failed: number;
};

export type AuditRunResult = {
  runId: string;
  jobId: string;
  processed: number;
  findingsCreated: number;
  failed: number;
};

export type SequenceGenerationResult = {
  runId: string;
  generated: number;
  updated: number;
};

export type ProviderStatus = {
  label: string;
  connected: boolean;
  hint: string;
};

export type DashboardSnapshot = {
  leads: Lead[];
  contacts: Contact[];
  runs: WorkflowRun[];
  emailThreads: EmailThread[];
  providerStatuses: ProviderStatus[];
  billingOverview: BillingOverview;
  stats: {
    leadCount: number;
    enrichedLeadCount: number;
    contactCount: number;
    failedLeadCount: number;
  };
  outreachStats: {
    auditJobCount: number;
    sequencesReadyCount: number;
    repliedCount: number;
    bookedCount: number;
    nurtureCount: number;
  };
};

export type OutreachSnapshot = {
  leads: Lead[];
  leadCrmMetadata: LeadCrmMetadata[];
  contacts: Contact[];
  runs: WorkflowRun[];
  serviceProfiles: ServiceProfile[];
  auditJobs: WebsiteAuditJob[];
  auditFindings: WebsiteAuditFinding[];
  prospectVariables: ProspectVariableSet[];
  sequenceTemplates: SequenceTemplate[];
  campaigns: Campaign[];
  campaignSteps: CampaignStep[];
  campaignLeads: CampaignLead[];
  campaignMetrics: CampaignMetrics[];
  generatedSequences: GeneratedSequence[];
  connectedMailboxes: ConnectedMailbox[];
  emailThreads: EmailThread[];
  emailMessages: EmailMessage[];
  outreachStates: ProspectOutreachState[];
  suppressionEntries: SuppressionEntry[];
  opportunities: Opportunity[];
  meetings: Meeting[];
  proposalTemplates: ProposalTemplate[];
  proposalDocuments: ProposalDocument[];
  clients: Client[];
  clientProjects: ClientProject[];
  projectTasks: ProjectTask[];
  clientAssets: ClientAsset[];
  clientAssetRequests: ClientAssetRequest[];
  reminders: Reminder[];
  activityNotes: ActivityNote[];
  serviceOfferProfiles: ServiceOfferProfile[];
  reportingConnections: ReportingConnection[];
  monthlyReports: MonthlyReport[];
  trashEntries: TrashEntry[];
  sheets: Array<{
    key: string;
    label: string;
    niche: string;
    location: string;
  }>;
  stats: {
    auditJobCount: number;
    findingsCount: number;
    sequencesReadyCount: number;
    repliedCount: number;
    bookedCount: number;
    nurtureCount: number;
    closedCount: number;
  };
};

export type WorkspaceTab =
  | "pipeline"
  | "companies"
  | "contacts"
  | "campaigns"
  | "inbox"
  | "sales"
  | "proposals"
  | "clients"
  | "projects"
  | "reports"
  | "data"
  | "trash";

export type WorkspaceCompanyStage =
  | "new"
  | "audited"
  | "drafted"
  | "approved"
  | "scheduled"
  | "sent"
  | "replied"
  | "booked"
  | "nurture"
  | "closed";

export type WorkspaceCompanyRecord = {
  lead: Lead;
  crm: LeadCrmMetadata | null;
  preferredContact: Contact | null;
  contacts: Contact[];
  campaign: Campaign | null;
  campaignLead: CampaignLead | null;
  sequence: GeneratedSequence | null;
  outreachState: ProspectOutreachState | null;
  thread: EmailThread | null;
  latestFinding: WebsiteAuditFinding | null;
  latestVariables: ProspectVariableSet | null;
  mailbox: ConnectedMailbox | null;
  opportunity: Opportunity | null;
  latestProposal: ProposalDocument | null;
  client: Client | null;
  reminders: Reminder[];
  meetings: Meeting[];
  activityNotes: ActivityNote[];
  activeProjects: ClientProject[];
  reports: MonthlyReport[];
  stage: WorkspaceCompanyStage;
  latestActivityAt: string;
  sourceSheetKey: string;
  sourceSheetLabel: string;
  serviceAngle: ServiceKey | null;
  nextStepLabel: string | null;
  needsAttention: boolean;
  searchText: string;
};

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  runId?: string;
};
