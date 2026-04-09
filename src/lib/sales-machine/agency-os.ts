import { getEnv } from "@/lib/env";
import { getGmailMailboxToken } from "@/lib/sales-machine/mailbox-config";
import { getDefaultProjectTaskTemplates } from "@/lib/sales-machine/agency-seeds";
import { refreshGoogleAccessToken } from "@/lib/sales-machine/gmail";
import { mutateDb, readDb } from "@/lib/sales-machine/store";
import type {
  ActivityEntityType,
  Client,
  ClientAssetRequest,
  ClientProject,
  Meeting,
  Opportunity,
  OpportunityStage,
  OpportunityStatus,
  ProjectTask,
  ProposalDocument,
  Reminder,
  ReportingConnection,
  ServiceKey,
  SalesMachineDb,
} from "@/lib/sales-machine/types";
import { compactNullableText, createId, nowIso, serializeError } from "@/lib/sales-machine/utils";

type ProposalGenerationResult = {
  proposalId: string;
  docUrl: string | null;
  pdfUrl: string | null;
};

function renderTemplate(template: string, variables: Record<string, string | boolean | null>) {
  return template.replace(/\[([A-Z0-9_]+)\]/g, (_, key: string) => {
    const value = variables[key];
    if (typeof value === "boolean") {
      return value ? "yes" : "no";
    }

    return typeof value === "string" ? value : "";
  });
}

function normalizeServiceLabel(serviceKey: ServiceKey) {
  return serviceKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toOpportunityStage(state: string): OpportunityStage {
  switch (state) {
    case "booked":
      return "meeting_booked";
    case "closed":
      return "lost";
    case "nurture":
      return "nurture";
    case "replied":
      return "qualified";
    default:
      return "new";
  }
}

function toOpportunityStatus(stage: OpportunityStage): OpportunityStatus {
  switch (stage) {
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "nurture":
      return "nurture";
    default:
      return "open";
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = compactNullableText(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildProposalVariables(db: SalesMachineDb, input: {
  leadId: string;
  serviceKey: ServiceKey;
  contactId?: string | null;
}) {
  const lead = db.leads.find((candidate) => candidate.id === input.leadId);
  if (!lead) {
    throw new Error("Lead was not found.");
  }

  const contact =
    (input.contactId
      ? db.contacts.find((candidate) => candidate.id === input.contactId)
      : null) ??
    db.contacts
      .filter((candidate) => candidate.leadId === input.leadId)
      .sort((a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)))[0] ??
    null;
  const finding =
    db.auditFindings
      .filter((candidate) => candidate.leadId === input.leadId && candidate.serviceKey === input.serviceKey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const variableSet =
    db.prospectVariables
      .filter((candidate) => candidate.leadId === input.leadId && candidate.serviceKey === input.serviceKey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const crm = db.leadCrmMetadata.find((candidate) => candidate.leadId === input.leadId) ?? null;
  const offerProfile =
    db.serviceOfferProfiles.find((candidate) => candidate.serviceKey === input.serviceKey) ?? null;

  return {
    COMPANY: lead.companyName,
    NAME: contact?.name ?? "there",
    PAGE:
      firstNonEmpty(
        variableSet?.variables.PAGE as string | null | undefined,
        finding?.pageLabel,
        finding?.pageUrl,
        "homepage",
      ) ?? "homepage",
    WEBSITE_PROBLEM:
      firstNonEmpty(
        variableSet?.variables.WEBSITE_PROBLEM as string | null | undefined,
        finding?.summary,
        "an issue worth fixing",
      ) ?? "an issue worth fixing",
    RECOGNIZABLE_REASON:
      firstNonEmpty(
        variableSet?.variables.RECOGNIZABLE_REASON as string | null | undefined,
        finding?.recognizableReason,
        "it affects how visitors understand the offer",
      ) ?? "it affects how visitors understand the offer",
    CONSEQUENCE_MECHANICS:
      firstNonEmpty(
        variableSet?.variables.CONSEQUENCE_MECHANICS as string | null | undefined,
        finding?.consequenceMechanics,
        "visitors may hesitate or fail to take the next step",
      ) ?? "visitors may hesitate or fail to take the next step",
    REVIEW_TIME:
      firstNonEmpty(
        variableSet?.variables.REVIEW_TIME as string | null | undefined,
        finding?.reviewTime,
        "a short review",
      ) ?? "a short review",
    MICRO_YES:
      firstNonEmpty(
        variableSet?.variables.MICRO_YES as string | null | undefined,
        finding?.microYes,
        "Want me to send it over?",
      ) ?? "Want me to send it over?",
    SERVICE_LABEL: offerProfile?.label ?? normalizeServiceLabel(input.serviceKey),
    SCOPE_DEFAULTS: offerProfile?.scopeDefaults ?? "",
    PRICING_NOTES: offerProfile?.pricingNotes ?? "Pricing depends on scope and implementation speed.",
    CRM_NOTES: crm?.notes ?? "",
    WEBSITE: lead.websiteUri ?? "",
    LOCATION: lead.locationLabel,
  } satisfies Record<string, string | boolean | null>;
}

async function ensureGoogleAccessToken(preferredMailboxId?: string | null) {
  const env = getEnv();
  const db = await readDb();
  const mailbox =
    (preferredMailboxId
      ? db.connectedMailboxes.find(
          (candidate) => candidate.id === preferredMailboxId && candidate.provider === "gmail",
        )
      : null) ??
    db.connectedMailboxes.find(
      (candidate) => candidate.status === "connected" && candidate.provider === "gmail",
    ) ??
    null;

  if (!mailbox) {
    return null;
  }

  const oauth = getGmailMailboxToken(mailbox);
  if (
    oauth.accessToken &&
    (!oauth.expiresAt || new Date(oauth.expiresAt).getTime() > Date.now() + 60_000)
  ) {
    return {
      mailboxId: mailbox.id,
      email: mailbox.email,
      accessToken: oauth.accessToken,
    };
  }

  if (
    !oauth.refreshToken ||
    !env.googleOauthClientId ||
    !env.googleOauthClientSecret ||
    !env.googleOauthRedirectUri
  ) {
    return null;
  }

  const refreshed = await refreshGoogleAccessToken(
    {
      clientId: env.googleOauthClientId,
      clientSecret: env.googleOauthClientSecret,
      redirectUri: env.googleOauthRedirectUri,
      appUrl: env.appUrl,
    },
    oauth.refreshToken,
  );

  await mutateDb((state) => {
    const target = state.connectedMailboxes.find((candidate) => candidate.id === mailbox.id);
    if (!target) {
      return;
    }

    target.oauthData = {
      ...target.oauthData,
      accessToken: refreshed.access_token,
      refreshToken: oauth.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    target.updatedAt = nowIso();
  });

  return {
    mailboxId: mailbox.id,
    email: mailbox.email,
    accessToken: refreshed.access_token,
  };
}

async function maybeCreateGoogleDoc(title: string, content: string, preferredMailboxId?: string | null) {
  const auth = await ensureGoogleAccessToken(preferredMailboxId);
  if (!auth) {
    return { docUrl: null, pdfUrl: null };
  }

  try {
    const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title }),
      cache: "no-store",
    });

    if (!createResponse.ok) {
      throw new Error(await createResponse.text());
    }

    const created = (await createResponse.json()) as { documentId: string };
    const updateResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${created.documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        }),
        cache: "no-store",
      },
    );

    if (!updateResponse.ok) {
      throw new Error(await updateResponse.text());
    }

    return {
      docUrl: `https://docs.google.com/document/d/${created.documentId}/edit`,
      pdfUrl: null,
    };
  } catch (error) {
    console.warn("Google Doc creation failed, keeping in-app record only.", serializeError(error));
    return { docUrl: null, pdfUrl: null };
  }
}

export function syncOpportunityFromOutreachStateInDb(
  db: SalesMachineDb,
  input: {
    leadId: string;
    serviceKey: ServiceKey;
    state: string;
    campaignId?: string | null;
    contactId?: string | null;
    occurredAt?: string;
  },
) {
  if (!input.leadId) {
    return null;
  }

  if (!["replied", "booked", "nurture", "closed", "no_show"].includes(input.state)) {
    return null;
  }

  const existing =
    db.opportunities
      .filter(
        (candidate) =>
          candidate.leadId === input.leadId &&
          candidate.serviceKey === input.serviceKey &&
          candidate.status !== "won",
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  const stage = toOpportunityStage(input.state);
  const status = toOpportunityStatus(stage);
  const touchAt = input.occurredAt ?? nowIso();

  if (existing) {
    existing.stage = stage;
    existing.status = status;
    existing.sourceCampaignId = input.campaignId ?? existing.sourceCampaignId;
    existing.contactId = input.contactId ?? existing.contactId;
    existing.lastTouchAt = touchAt;
    existing.updatedAt = nowIso();
    existing.nextStep =
      input.state === "booked"
        ? "Prepare the discovery call"
        : input.state === "replied"
          ? "Reply and qualify the opportunity"
          : input.state === "nurture"
            ? "Revisit later with a better angle"
            : existing.nextStep;
    return existing;
  }

  const created: Opportunity = {
    id: createId("opportunity"),
    leadId: input.leadId,
    contactId: input.contactId ?? null,
    serviceKey: input.serviceKey,
    sourceCampaignId: input.campaignId ?? null,
    stage,
    status,
    estimatedValueUsd: null,
    closeProbability: input.state === "booked" ? 65 : input.state === "replied" ? 35 : 20,
    nextStep:
      input.state === "booked"
        ? "Prepare the discovery call"
        : input.state === "replied"
          ? "Reply and qualify the opportunity"
          : input.state === "nurture"
            ? "Revisit later with a better angle"
            : "Review the account",
    nextStepDueAt: null,
    lastTouchAt: touchAt,
    notes: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.opportunities.push(created);
  return created;
}

export async function upsertOpportunity(input: {
  leadId: string;
  contactId?: string | null;
  serviceKey: ServiceKey;
  sourceCampaignId?: string | null;
  stage?: OpportunityStage;
  status?: OpportunityStatus;
  estimatedValueUsd?: number | null;
  closeProbability?: number | null;
  nextStep?: string | null;
  nextStepDueAt?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const existing =
      db.opportunities
        .filter(
          (candidate) =>
            candidate.leadId === input.leadId &&
            candidate.serviceKey === input.serviceKey &&
            candidate.status !== "won",
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

    if (existing) {
      existing.contactId = input.contactId ?? existing.contactId;
      existing.sourceCampaignId = input.sourceCampaignId ?? existing.sourceCampaignId;
      existing.stage = input.stage ?? existing.stage;
      existing.status = input.status ?? existing.status;
      existing.estimatedValueUsd = input.estimatedValueUsd ?? existing.estimatedValueUsd;
      existing.closeProbability = input.closeProbability ?? existing.closeProbability;
      existing.nextStep = compactNullableText(input.nextStep) ?? existing.nextStep;
      existing.nextStepDueAt = input.nextStepDueAt ?? existing.nextStepDueAt;
      existing.notes = compactNullableText(input.notes) ?? existing.notes;
      existing.lastTouchAt = nowIso();
      existing.updatedAt = nowIso();
      return existing;
    }

    const created: Opportunity = {
      id: createId("opportunity"),
      leadId: input.leadId,
      contactId: input.contactId ?? null,
      serviceKey: input.serviceKey,
      sourceCampaignId: input.sourceCampaignId ?? null,
      stage: input.stage ?? "new",
      status: input.status ?? "open",
      estimatedValueUsd: input.estimatedValueUsd ?? null,
      closeProbability: input.closeProbability ?? null,
      nextStep: compactNullableText(input.nextStep),
      nextStepDueAt: input.nextStepDueAt ?? null,
      lastTouchAt: nowIso(),
      notes: compactNullableText(input.notes),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.opportunities.push(created);
    return created;
  });
}

export async function updateOpportunityStage(input: {
  opportunityId: string;
  stage: OpportunityStage;
  status?: OpportunityStatus;
  nextStep?: string | null;
  nextStepDueAt?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const opportunity = db.opportunities.find((candidate) => candidate.id === input.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity was not found.");
    }

    opportunity.stage = input.stage;
    opportunity.status = input.status ?? toOpportunityStatus(input.stage);
    opportunity.nextStep = compactNullableText(input.nextStep) ?? opportunity.nextStep;
    opportunity.nextStepDueAt = input.nextStepDueAt ?? opportunity.nextStepDueAt;
    opportunity.notes = compactNullableText(input.notes) ?? opportunity.notes;
    opportunity.lastTouchAt = nowIso();
    opportunity.updatedAt = nowIso();
    return opportunity;
  });
}

export async function createMeeting(input: {
  leadId: string;
  opportunityId?: string | null;
  contactId?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  agenda?: string | null;
  prepNotes?: string | null;
  outcome?: string | null;
  followUpDueAt?: string | null;
  status?: Meeting["status"];
}) {
  return mutateDb((db) => {
    const meeting: Meeting = {
      id: createId("meeting"),
      leadId: input.leadId,
      opportunityId: input.opportunityId ?? null,
      contactId: input.contactId ?? null,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      agenda: compactNullableText(input.agenda),
      prepNotes: compactNullableText(input.prepNotes),
      outcome: compactNullableText(input.outcome),
      followUpDueAt: input.followUpDueAt ?? null,
      status: input.status ?? "planned",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.meetings.push(meeting);

    if (meeting.opportunityId) {
      const opportunity = db.opportunities.find((candidate) => candidate.id === meeting.opportunityId);
      if (opportunity) {
        opportunity.stage = "meeting_booked";
        opportunity.status = "open";
        opportunity.lastTouchAt = nowIso();
        opportunity.nextStep = "Prepare and run the meeting";
        opportunity.nextStepDueAt = meeting.scheduledAt;
        opportunity.updatedAt = nowIso();
      }
    }

    return meeting;
  });
}

export async function createReminder(input: {
  title: string;
  dueAt: string;
  leadId?: string | null;
  opportunityId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const reminder: Reminder = {
      id: createId("reminder"),
      leadId: input.leadId ?? null,
      opportunityId: input.opportunityId ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      title: input.title.trim(),
      dueAt: input.dueAt,
      status: "open",
      notes: compactNullableText(input.notes),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.reminders.push(reminder);
    return reminder;
  });
}

export async function addActivityNote(input: {
  entityType: ActivityEntityType;
  entityId: string;
  body: string;
  leadId?: string | null;
  clientId?: string | null;
}) {
  return mutateDb((db) => {
    const note = {
      id: createId("note"),
      entityType: input.entityType,
      entityId: input.entityId,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      body: input.body.trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as const;
    db.activityNotes.push(note);
    return note;
  });
}

export async function generateProposal(input: {
  opportunityId: string;
  amountUsd?: number | null;
  preferredMailboxId?: string | null;
}) {
  const db = await readDb();
  const opportunity = db.opportunities.find((candidate) => candidate.id === input.opportunityId);
  if (!opportunity) {
    throw new Error("Opportunity was not found.");
  }

  const template = db.proposalTemplates.find((candidate) => candidate.serviceKey === opportunity.serviceKey);
  if (!template) {
    throw new Error("Proposal template was not found for this service.");
  }

  const variables = buildProposalVariables(db, {
    leadId: opportunity.leadId,
    serviceKey: opportunity.serviceKey,
    contactId: opportunity.contactId,
  });

  const title = renderTemplate(template.titleTemplate, variables);
  const content = renderTemplate(template.bodyTemplate, variables);
  const docAssets = await maybeCreateGoogleDoc(title, content, input.preferredMailboxId ?? null);
  const proposalId = createId("proposal");

  await mutateDb((state) => {
    const targetOpportunity = state.opportunities.find((candidate) => candidate.id === input.opportunityId);
    if (!targetOpportunity) {
      throw new Error("Opportunity was not found while saving the proposal.");
    }

    const proposal: ProposalDocument = {
      id: proposalId,
      opportunityId: targetOpportunity.id,
      leadId: targetOpportunity.leadId,
      contactId: targetOpportunity.contactId,
      serviceKey: targetOpportunity.serviceKey,
      status: "draft",
      title,
      amountUsd: input.amountUsd ?? targetOpportunity.estimatedValueUsd ?? null,
      content,
      docUrl: docAssets.docUrl,
      pdfUrl: docAssets.pdfUrl,
      sentAt: null,
      acceptedAt: null,
      lostAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    state.proposalDocuments.push(proposal);
    targetOpportunity.stage = "proposal_drafted";
    targetOpportunity.status = "open";
    targetOpportunity.lastTouchAt = nowIso();
    targetOpportunity.updatedAt = nowIso();
  });

  return {
    proposalId,
    docUrl: docAssets.docUrl,
    pdfUrl: docAssets.pdfUrl,
  } satisfies ProposalGenerationResult;
}

export async function createClientFromOpportunity(input: {
  opportunityId: string;
  startDate?: string | null;
  retainerType?: Client["retainerType"];
  billingCycle?: string | null;
}) {
  return mutateDb((db) => {
    const opportunity = db.opportunities.find((candidate) => candidate.id === input.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity was not found.");
    }

    const existingClient = db.clients.find((candidate) => candidate.sourceOpportunityId === opportunity.id);
    if (existingClient) {
      return existingClient;
    }

    const client: Client = {
      id: createId("client"),
      leadId: opportunity.leadId,
      primaryContactId: opportunity.contactId,
      sourceOpportunityId: opportunity.id,
      status: "active",
      startDate: input.startDate ?? nowIso(),
      retainerType: input.retainerType ?? "project",
      billingCycle: compactNullableText(input.billingCycle),
      notes: null,
      driveFolderUrl: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.clients.push(client);

    const project: ClientProject = {
      id: createId("project"),
      clientId: client.id,
      serviceKey: opportunity.serviceKey,
      name: `${normalizeServiceLabel(opportunity.serviceKey)} Delivery`,
      status: "planned",
      startDate: client.startDate,
      targetDate: null,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.clientProjects.push(project);

    for (const [index, title] of getDefaultProjectTaskTemplates(opportunity.serviceKey).entries()) {
      const task: ProjectTask = {
        id: createId("task"),
        projectId: project.id,
        title,
        status: "todo",
        dueAt: null,
        notes: null,
        sortOrder: index,
        completedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.projectTasks.push(task);
    }

    opportunity.stage = "won";
    opportunity.status = "won";
    opportunity.lastTouchAt = nowIso();
    opportunity.updatedAt = nowIso();
    opportunity.nextStep = "Start onboarding and delivery";

    const latestProposal =
      db.proposalDocuments
        .filter((candidate) => candidate.opportunityId === opportunity.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    if (latestProposal) {
      latestProposal.status = "accepted";
      latestProposal.acceptedAt = nowIso();
      latestProposal.updatedAt = nowIso();
    }

    return client;
  });
}

export async function updateProposalStatus(input: {
  proposalId: string;
  status: ProposalDocument["status"];
}) {
  const proposal = await mutateDb((db) => {
    const target = db.proposalDocuments.find((candidate) => candidate.id === input.proposalId);
    if (!target) {
      throw new Error("Proposal was not found.");
    }

    target.status = input.status;
    target.updatedAt = nowIso();
    if (input.status === "sent") target.sentAt = nowIso();
    if (input.status === "accepted") target.acceptedAt = nowIso();
    if (input.status === "lost") target.lostAt = nowIso();

    const opportunity = db.opportunities.find((candidate) => candidate.id === target.opportunityId);
    if (opportunity) {
      if (input.status === "sent") {
        opportunity.stage = "proposal_sent";
        opportunity.status = "open";
      } else if (input.status === "accepted") {
        opportunity.stage = "won";
        opportunity.status = "won";
      } else if (input.status === "lost") {
        opportunity.stage = "lost";
        opportunity.status = "lost";
      }

      opportunity.lastTouchAt = nowIso();
      opportunity.updatedAt = nowIso();
    }

    return target;
  });

  if (input.status === "accepted") {
    await createClientFromOpportunity({ opportunityId: proposal.opportunityId });
  }

  return proposal;
}

export async function createClientProject(input: {
  clientId: string;
  serviceKey: ServiceKey;
  name: string;
  startDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const project: ClientProject = {
      id: createId("project"),
      clientId: input.clientId,
      serviceKey: input.serviceKey,
      name: input.name.trim(),
      status: "planned",
      startDate: input.startDate ?? null,
      targetDate: input.targetDate ?? null,
      notes: compactNullableText(input.notes),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.clientProjects.push(project);
    return project;
  });
}

export async function createProjectTask(input: {
  projectId: string;
  title: string;
  dueAt?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const sortOrder =
      db.projectTasks
        .filter((candidate) => candidate.projectId === input.projectId)
        .reduce((max, candidate) => Math.max(max, candidate.sortOrder), -1) + 1;

    const task: ProjectTask = {
      id: createId("task"),
      projectId: input.projectId,
      title: input.title.trim(),
      status: "todo",
      dueAt: input.dueAt ?? null,
      notes: compactNullableText(input.notes),
      sortOrder,
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.projectTasks.push(task);
    return task;
  });
}

export async function updateProjectTask(input: {
  taskId: string;
  status: ProjectTask["status"];
  title?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}) {
  return mutateDb((db) => {
    const task = db.projectTasks.find((candidate) => candidate.id === input.taskId);
    if (!task) {
      throw new Error("Project task was not found.");
    }

    task.status = input.status;
    task.title = compactNullableText(input.title) ?? task.title;
    task.dueAt = input.dueAt ?? task.dueAt;
    task.notes = compactNullableText(input.notes) ?? task.notes;
    task.completedAt = input.status === "done" ? nowIso() : null;
    task.updatedAt = nowIso();
    return task;
  });
}

export async function createReportingConnection(input: {
  clientId: string;
  kind: ReportingConnection["kind"];
  target: string;
  status?: ReportingConnection["status"];
  settings?: Record<string, unknown>;
}) {
  return mutateDb((db) => {
    const existing = db.reportingConnections.find(
      (candidate) =>
        candidate.clientId === input.clientId &&
        candidate.kind === input.kind &&
        candidate.target === input.target,
    );
    if (existing) {
      existing.status = input.status ?? existing.status;
      existing.settings = input.settings ?? existing.settings;
      existing.updatedAt = nowIso();
      return existing;
    }

    const connection: ReportingConnection = {
      id: createId("reporting"),
      clientId: input.clientId,
      kind: input.kind,
      target: input.target.trim(),
      status: input.status ?? "setup_needed",
      settings: input.settings ?? {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.reportingConnections.push(connection);
    return connection;
  });
}

async function fetchPageSpeedMetric(target: string) {
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", target);
  url.searchParams.set("strategy", "mobile");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`PageSpeed fetch failed (${response.status}).`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const lighthouse = payload.lighthouseResult as Record<string, unknown> | undefined;
  const categories = (lighthouse?.categories as Record<string, { score?: number }> | undefined) ?? {};
  return {
    performanceScore:
      typeof categories.performance?.score === "number"
        ? Math.round(categories.performance.score * 100)
        : null,
    accessibilityScore:
      typeof categories.accessibility?.score === "number"
        ? Math.round(categories.accessibility.score * 100)
        : null,
  };
}

async function fetchSearchConsoleSummary(accessToken: string, siteUrl: string) {
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        rowLimit: 10,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Search Console fetch failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    rows?: Array<{ clicks?: number; impressions?: number; ctr?: number; position?: number }>;
  };
  const rows = payload.rows ?? [];
  return {
    clicks: rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0),
    impressions: rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0),
    avgCtr:
      rows.length > 0 ? rows.reduce((sum, row) => sum + (row.ctr ?? 0), 0) / rows.length : null,
  };
}

async function fetchGa4Summary(accessToken: string, propertyId: string) {
  const normalized = propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${normalized}:runReport`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GA4 fetch failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const metrics = payload.rows?.[0]?.metricValues ?? [];
  return {
    sessions: Number.parseInt(metrics[0]?.value ?? "0", 10),
    conversions: Number.parseInt(metrics[1]?.value ?? "0", 10),
  };
}

export async function generateMonthlyReport(input: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  preferredMailboxId?: string | null;
}) {
  const db = await readDb();
  const client = db.clients.find((candidate) => candidate.id === input.clientId);
  if (!client) {
    throw new Error("Client was not found.");
  }

  const connections = db.reportingConnections.filter((candidate) => candidate.clientId === input.clientId);
  const metricsSnapshot: Record<string, unknown> = {};
  const auth = await ensureGoogleAccessToken(input.preferredMailboxId ?? null);

  for (const connection of connections) {
    try {
      if (connection.kind === "pagespeed") {
        metricsSnapshot.pagespeed = await fetchPageSpeedMetric(connection.target);
      } else if (connection.kind === "search_console" && auth) {
        metricsSnapshot.searchConsole = await fetchSearchConsoleSummary(auth.accessToken, connection.target);
      } else if (connection.kind === "ga4" && auth) {
        metricsSnapshot.ga4 = await fetchGa4Summary(auth.accessToken, connection.target);
      }
    } catch (error) {
      metricsSnapshot[`${connection.kind}Error`] = serializeError(error);
    }
  }

  const lead = db.leads.find((candidate) => candidate.id === client.leadId);
  const content = [
    `# Monthly report for ${lead?.companyName ?? "Client"}`,
    "",
    `Period: ${input.periodStart} to ${input.periodEnd}`,
    "",
    "## Snapshot",
    JSON.stringify(metricsSnapshot, null, 2),
    "",
    "## Summary",
    "This draft consolidates the currently connected reporting sources. Review the numbers, add narrative context, and then send it manually when ready.",
  ].join("\n");
  const docAssets = await maybeCreateGoogleDoc(
    `${lead?.companyName ?? "Client"} · Monthly Report`,
    content,
    input.preferredMailboxId ?? null,
  );
  const summary = Object.entries(metricsSnapshot)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(" · ");

  return mutateDb((state) => {
    const report = {
      id: createId("report"),
      clientId: input.clientId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "draft" as const,
      title: `${lead?.companyName ?? "Client"} · Monthly Report`,
      summary: summary || "Draft report created. Add live commentary before sending.",
      content,
      metricsSnapshot,
      docUrl: docAssets.docUrl,
      generatedAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.monthlyReports.push(report);
    return report;
  });
}

export async function requestClientAsset(input: {
  clientId: string;
  type: string;
  description?: string | null;
}) {
  return mutateDb((db) => {
    const request: ClientAssetRequest = {
      id: createId("asset_request"),
      clientId: input.clientId,
      type: input.type.trim(),
      status: "requested",
      description: compactNullableText(input.description),
      requestedAt: nowIso(),
      receivedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.clientAssetRequests.push(request);
    return request;
  });
}
