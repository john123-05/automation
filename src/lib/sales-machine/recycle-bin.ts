import type {
  Campaign,
  Contact,
  Lead,
  SalesMachineDb,
  TrashEntityType,
  TrashEntry,
  TrashPayload,
} from "@/lib/sales-machine/types";
import { createId, nowIso } from "@/lib/sales-machine/utils";
import { createSheetKey } from "@/lib/sales-machine/workspace-sheets";

export const TRASH_RETENTION_DAYS = 30;

const trashPayloadKeys = [
  "leads",
  "leadCrmMetadata",
  "contacts",
  "runs",
  "searchJobs",
  "enrichmentJobs",
  "auditJobs",
  "auditFindings",
  "prospectVariables",
  "campaigns",
  "campaignSteps",
  "campaignLeads",
  "generatedSequences",
  "emailThreads",
  "emailMessages",
  "outreachStates",
  "opportunities",
  "meetings",
  "proposalDocuments",
  "clients",
  "clientProjects",
  "projectTasks",
  "clientAssets",
  "clientAssetRequests",
  "reminders",
  "activityNotes",
  "reportingConnections",
  "monthlyReports",
] as const satisfies ReadonlyArray<keyof TrashPayload>;

function addRetentionWindow(deletedAt: string) {
  const expiresAt = new Date(deletedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + TRASH_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function partition<T>(items: T[], predicate: (item: T) => boolean) {
  const kept: T[] = [];
  const removed: T[] = [];

  for (const item of items) {
    if (predicate(item)) {
      removed.push(item);
    } else {
      kept.push(item);
    }
  }

  return { kept, removed };
}

function takeWhere<K extends keyof SalesMachineDb>(
  db: SalesMachineDb,
  key: K,
  predicate: (item: SalesMachineDb[K][number]) => boolean,
) {
  const { kept, removed } = partition(
    db[key] as SalesMachineDb[K][number][],
    predicate,
  );

  db[key] = kept as SalesMachineDb[K];
  return removed;
}

function touchLeadContactState(db: SalesMachineDb, leadId: string) {
  const lead = db.leads.find((entry) => entry.id === leadId);

  if (!lead) {
    return;
  }

  lead.contactCount = db.contacts.filter((contact) => contact.leadId === leadId).length;
  lead.updatedAt = nowIso();
}

function buildTrashSummary(payload: TrashPayload) {
  const summaryParts: string[] = [];

  for (const key of trashPayloadKeys) {
    const count = payload[key]?.length ?? 0;

    if (!count) {
      continue;
    }

    const label = {
      leads: "companies",
      leadCrmMetadata: "CRM records",
      contacts: "contacts",
      runs: "runs",
      searchJobs: "search jobs",
      enrichmentJobs: "enrichment jobs",
      auditJobs: "audit jobs",
      auditFindings: "audit findings",
      prospectVariables: "prospect variable sets",
      campaigns: "campaigns",
      campaignSteps: "campaign steps",
      campaignLeads: "campaign lead links",
      generatedSequences: "sequences",
      emailThreads: "threads",
      emailMessages: "messages",
      outreachStates: "outreach states",
      opportunities: "opportunities",
      meetings: "meetings",
      proposalDocuments: "proposals",
      clients: "clients",
      clientProjects: "projects",
      projectTasks: "tasks",
      clientAssets: "client assets",
      clientAssetRequests: "asset requests",
      reminders: "reminders",
      activityNotes: "activity notes",
      reportingConnections: "reporting connections",
      monthlyReports: "reports",
    }[key];

    summaryParts.push(`${count} ${label}`);
  }

  return summaryParts.join(", ");
}

function appendTrashEntry(
  db: SalesMachineDb,
  input: {
    entityType: TrashEntityType;
    entityId: string;
    label: string;
    payload: TrashPayload;
  },
) {
  const deletedAt = nowIso();

  const entry: TrashEntry = {
    id: createId("trash"),
    entityType: input.entityType,
    entityId: input.entityId,
    label: input.label,
    summary: buildTrashSummary(input.payload),
    deletedAt,
    expiresAt: addRetentionWindow(deletedAt),
    payload: input.payload,
  };

  db.trashEntries.unshift(entry);
}

export function pruneExpiredTrashEntries(db: SalesMachineDb, now = new Date()) {
  db.trashEntries = db.trashEntries.filter((entry) => new Date(entry.expiresAt).getTime() > now.getTime());
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const merged = new Map<string, T>();

  for (const item of items) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

export function restoreTrashEntry(db: SalesMachineDb, trashEntryId: string) {
  const entry = db.trashEntries.find((candidate) => candidate.id === trashEntryId);

  if (!entry) {
    throw new Error("Trash item not found.");
  }

  for (const key of trashPayloadKeys) {
    const removedItems = entry.payload[key];

    if (!removedItems?.length) {
      continue;
    }

    const currentItems = db[key] as { id: string }[];
    db[key] = uniqueById([...currentItems, ...removedItems] as { id: string }[]) as never;
  }

  db.trashEntries = db.trashEntries.filter((candidate) => candidate.id !== trashEntryId);
}

function filterPayload<T>(items: T[]) {
  return items.length ? items : undefined;
}

function detachLeadCascade(db: SalesMachineDb, leadIds: Set<string>): TrashPayload {
  const clientIds = new Set(
    db.clients.filter((client) => leadIds.has(client.leadId)).map((client) => client.id),
  );
  const projectIds = new Set(
    db.clientProjects
      .filter((project) => clientIds.has(project.clientId))
      .map((project) => project.id),
  );
  const opportunityIds = new Set(
    db.opportunities
      .filter((opportunity) => leadIds.has(opportunity.leadId))
      .map((opportunity) => opportunity.id),
  );
  const threadIds = new Set(
    db.emailThreads
      .filter((thread) => leadIds.has(thread.leadId ?? ""))
      .map((thread) => thread.id),
  );
  const sequenceIds = new Set(
    db.generatedSequences
      .filter((sequence) => leadIds.has(sequence.leadId))
      .map((sequence) => sequence.id),
  );

  return {
    leads: filterPayload(takeWhere(db, "leads", (lead) => leadIds.has(lead.id as string)) as Lead[]),
    leadCrmMetadata: filterPayload(
      takeWhere(db, "leadCrmMetadata", (item) => leadIds.has(item.leadId)),
    ),
    contacts: filterPayload(takeWhere(db, "contacts", (item) => leadIds.has(item.leadId)) as Contact[]),
    auditFindings: filterPayload(
      takeWhere(db, "auditFindings", (item) => leadIds.has(item.leadId)),
    ),
    prospectVariables: filterPayload(
      takeWhere(db, "prospectVariables", (item) => leadIds.has(item.leadId)),
    ),
    campaignLeads: filterPayload(
      takeWhere(db, "campaignLeads", (item) => leadIds.has(item.leadId)),
    ),
    generatedSequences: filterPayload(
      takeWhere(db, "generatedSequences", (item) => leadIds.has(item.leadId)),
    ),
    emailThreads: filterPayload(
      takeWhere(db, "emailThreads", (item) => leadIds.has(item.leadId ?? "")),
    ),
    emailMessages: filterPayload(
      takeWhere(db, "emailMessages", (item) => threadIds.has(item.threadId)),
    ),
    outreachStates: filterPayload(
      takeWhere(
        db,
        "outreachStates",
        (item) =>
          leadIds.has(item.leadId) ||
          sequenceIds.has(item.sequenceId ?? "") ||
          threadIds.has(item.threadId ?? ""),
      ),
    ),
    opportunities: filterPayload(
      takeWhere(db, "opportunities", (item) => leadIds.has(item.leadId)),
    ),
    meetings: filterPayload(
      takeWhere(
        db,
        "meetings",
        (item) => leadIds.has(item.leadId) || opportunityIds.has(item.opportunityId ?? ""),
      ),
    ),
    proposalDocuments: filterPayload(
      takeWhere(
        db,
        "proposalDocuments",
        (item) => leadIds.has(item.leadId) || opportunityIds.has(item.opportunityId),
      ),
    ),
    clients: filterPayload(takeWhere(db, "clients", (item) => leadIds.has(item.leadId))),
    clientProjects: filterPayload(
      takeWhere(db, "clientProjects", (item) => clientIds.has(item.clientId)),
    ),
    projectTasks: filterPayload(
      takeWhere(db, "projectTasks", (item) => projectIds.has(item.projectId)),
    ),
    clientAssets: filterPayload(
      takeWhere(db, "clientAssets", (item) => clientIds.has(item.clientId)),
    ),
    clientAssetRequests: filterPayload(
      takeWhere(db, "clientAssetRequests", (item) => clientIds.has(item.clientId)),
    ),
    reminders: filterPayload(
      takeWhere(
        db,
        "reminders",
        (item) =>
          leadIds.has(item.leadId ?? "") ||
          opportunityIds.has(item.opportunityId ?? "") ||
          clientIds.has(item.clientId ?? "") ||
          projectIds.has(item.projectId ?? ""),
      ),
    ),
    activityNotes: filterPayload(
      takeWhere(
        db,
        "activityNotes",
        (item) =>
          leadIds.has(item.leadId ?? "") ||
          clientIds.has(item.clientId ?? "") ||
          (item.entityType === "lead" && leadIds.has(item.entityId)) ||
          (item.entityType === "client" && clientIds.has(item.entityId)) ||
          (item.entityType === "project" && projectIds.has(item.entityId)) ||
          (item.entityType === "opportunity" && opportunityIds.has(item.entityId)),
      ),
    ),
    reportingConnections: filterPayload(
      takeWhere(db, "reportingConnections", (item) => clientIds.has(item.clientId)),
    ),
    monthlyReports: filterPayload(
      takeWhere(db, "monthlyReports", (item) => clientIds.has(item.clientId)),
    ),
  };
}

function detachRunCascade(db: SalesMachineDb, runIds: Set<string>): TrashPayload {
  const auditJobIds = new Set(
    db.auditJobs.filter((job) => runIds.has(job.runId)).map((job) => job.id),
  );

  return {
    runs: filterPayload(takeWhere(db, "runs", (item) => runIds.has(item.id))),
    searchJobs: filterPayload(takeWhere(db, "searchJobs", (item) => runIds.has(item.runId))),
    enrichmentJobs: filterPayload(
      takeWhere(db, "enrichmentJobs", (item) => runIds.has(item.runId)),
    ),
    auditJobs: filterPayload(takeWhere(db, "auditJobs", (item) => runIds.has(item.runId))),
    auditFindings: filterPayload(
      takeWhere(db, "auditFindings", (item) => auditJobIds.has(item.jobId)),
    ),
  };
}

function detachCampaignCascade(db: SalesMachineDb, campaignIds: Set<string>): TrashPayload {
  const sequenceIds = new Set(
    db.generatedSequences
      .filter((sequence) => campaignIds.has(sequence.campaignId ?? ""))
      .map((sequence) => sequence.id),
  );
  const threadIds = new Set(
    db.emailThreads
      .filter((thread) => campaignIds.has(thread.campaignId ?? ""))
      .map((thread) => thread.id),
  );

  for (const opportunity of db.opportunities) {
    if (campaignIds.has(opportunity.sourceCampaignId ?? "")) {
      opportunity.sourceCampaignId = null;
      opportunity.updatedAt = nowIso();
    }
  }

  return {
    campaigns: filterPayload(takeWhere(db, "campaigns", (item) => campaignIds.has(item.id)) as Campaign[]),
    campaignSteps: filterPayload(
      takeWhere(db, "campaignSteps", (item) => campaignIds.has(item.campaignId)),
    ),
    campaignLeads: filterPayload(
      takeWhere(db, "campaignLeads", (item) => campaignIds.has(item.campaignId)),
    ),
    generatedSequences: filterPayload(
      takeWhere(db, "generatedSequences", (item) => campaignIds.has(item.campaignId ?? "")),
    ),
    emailThreads: filterPayload(
      takeWhere(
        db,
        "emailThreads",
        (item) => campaignIds.has(item.campaignId ?? "") || sequenceIds.has(item.sequenceId ?? ""),
      ),
    ),
    emailMessages: filterPayload(
      takeWhere(db, "emailMessages", (item) => threadIds.has(item.threadId)),
    ),
    outreachStates: filterPayload(
      takeWhere(
        db,
        "outreachStates",
        (item) =>
          campaignIds.has(item.campaignId ?? "") ||
          sequenceIds.has(item.sequenceId ?? "") ||
          threadIds.has(item.threadId ?? ""),
      ),
    ),
  };
}

function detachProjectCascade(db: SalesMachineDb, projectIds: Set<string>): TrashPayload {
  return {
    clientProjects: filterPayload(
      takeWhere(db, "clientProjects", (item) => projectIds.has(item.id)),
    ),
    projectTasks: filterPayload(
      takeWhere(db, "projectTasks", (item) => projectIds.has(item.projectId)),
    ),
    reminders: filterPayload(
      takeWhere(db, "reminders", (item) => projectIds.has(item.projectId ?? "")),
    ),
    activityNotes: filterPayload(
      takeWhere(
        db,
        "activityNotes",
        (item) => item.entityType === "project" && projectIds.has(item.entityId),
      ),
    ),
  };
}

function detachClientCascade(db: SalesMachineDb, clientIds: Set<string>): TrashPayload {
  const projectIds = new Set(
    db.clientProjects
      .filter((project) => clientIds.has(project.clientId))
      .map((project) => project.id),
  );

  return {
    clients: filterPayload(takeWhere(db, "clients", (item) => clientIds.has(item.id))),
    ...detachProjectCascade(db, projectIds),
    clientAssets: filterPayload(
      takeWhere(db, "clientAssets", (item) => clientIds.has(item.clientId)),
    ),
    clientAssetRequests: filterPayload(
      takeWhere(db, "clientAssetRequests", (item) => clientIds.has(item.clientId)),
    ),
    reminders: filterPayload([
      ...(takeWhere(db, "reminders", (item) => clientIds.has(item.clientId ?? "")) ?? []),
    ]),
    activityNotes: filterPayload([
      ...(takeWhere(
        db,
        "activityNotes",
        (item) =>
          clientIds.has(item.clientId ?? "") ||
          (item.entityType === "client" && clientIds.has(item.entityId)),
      ) ?? []),
    ]),
    reportingConnections: filterPayload(
      takeWhere(db, "reportingConnections", (item) => clientIds.has(item.clientId)),
    ),
    monthlyReports: filterPayload(
      takeWhere(db, "monthlyReports", (item) => clientIds.has(item.clientId)),
    ),
  };
}

function compactPayloadParts(...parts: TrashPayload[]) {
  const merged: TrashPayload = {};

  for (const part of parts) {
    for (const key of trashPayloadKeys) {
      const value = part[key];

      if (!value?.length) {
        continue;
      }

      merged[key] = ([...(merged[key] ?? []), ...value] as { id: string }[]) as never;
    }
  }

  for (const key of trashPayloadKeys) {
    const value = merged[key];

    if (!value?.length) {
      delete merged[key];
      continue;
    }

    merged[key] = uniqueById(value as { id: string }[]) as never;
  }

  return merged;
}

export function moveLeadToTrash(db: SalesMachineDb, leadId: string) {
  const lead = db.leads.find((entry) => entry.id === leadId);

  if (!lead) {
    throw new Error("Company not found.");
  }

  const payload = detachLeadCascade(db, new Set([leadId]));
  appendTrashEntry(db, {
    entityType: "lead",
    entityId: lead.id,
    label: lead.companyName,
    payload,
  });
}

export function moveContactToTrash(db: SalesMachineDb, contactId: string) {
  const contact = db.contacts.find((entry) => entry.id === contactId);

  if (!contact) {
    throw new Error("Contact not found.");
  }

  const removedContacts = takeWhere(db, "contacts", (entry) => entry.id === contactId);

  for (const opportunity of db.opportunities) {
    if (opportunity.contactId === contactId) {
      opportunity.contactId = null;
      opportunity.updatedAt = nowIso();
    }
  }

  for (const meeting of db.meetings) {
    if (meeting.contactId === contactId) {
      meeting.contactId = null;
      meeting.updatedAt = nowIso();
    }
  }

  for (const proposal of db.proposalDocuments) {
    if (proposal.contactId === contactId) {
      proposal.contactId = null;
      proposal.updatedAt = nowIso();
    }
  }

  for (const client of db.clients) {
    if (client.primaryContactId === contactId) {
      client.primaryContactId = null;
      client.updatedAt = nowIso();
    }
  }

  for (const campaignLead of db.campaignLeads) {
    if (campaignLead.contactId === contactId) {
      campaignLead.contactId = null;
      campaignLead.updatedAt = nowIso();
    }
  }

  for (const variableSet of db.prospectVariables) {
    if (variableSet.contactId === contactId) {
      variableSet.contactId = null;
      variableSet.updatedAt = nowIso();
    }
  }

  touchLeadContactState(db, contact.leadId);

  appendTrashEntry(db, {
    entityType: "contact",
    entityId: contact.id,
    label: contact.name,
    payload: {
      contacts: filterPayload(removedContacts),
    },
  });
}

export function moveRunToTrash(db: SalesMachineDb, runId: string) {
  const run = db.runs.find((entry) => entry.id === runId);

  if (!run) {
    throw new Error("Run not found.");
  }

  appendTrashEntry(db, {
    entityType: "run",
    entityId: run.id,
    label: run.summary ?? run.kind,
    payload: detachRunCascade(db, new Set([runId])),
  });
}

export function moveCampaignToTrash(db: SalesMachineDb, campaignId: string) {
  const campaign = db.campaigns.find((entry) => entry.id === campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  appendTrashEntry(db, {
    entityType: "campaign",
    entityId: campaign.id,
    label: campaign.name,
    payload: detachCampaignCascade(db, new Set([campaignId])),
  });
}

export function moveOpportunityToTrash(db: SalesMachineDb, opportunityId: string) {
  const opportunity = db.opportunities.find((entry) => entry.id === opportunityId);

  if (!opportunity) {
    throw new Error("Opportunity not found.");
  }

  const payload: TrashPayload = {
    opportunities: filterPayload(
      takeWhere(db, "opportunities", (entry) => entry.id === opportunityId),
    ),
    meetings: filterPayload(
      takeWhere(db, "meetings", (entry) => entry.opportunityId === opportunityId),
    ),
    proposalDocuments: filterPayload(
      takeWhere(db, "proposalDocuments", (entry) => entry.opportunityId === opportunityId),
    ),
    reminders: filterPayload(
      takeWhere(db, "reminders", (entry) => entry.opportunityId === opportunityId),
    ),
    activityNotes: filterPayload(
      takeWhere(
        db,
        "activityNotes",
        (entry) => entry.entityType === "opportunity" && entry.entityId === opportunityId,
      ),
    ),
  };

  for (const client of db.clients) {
    if (client.sourceOpportunityId === opportunityId) {
      client.sourceOpportunityId = null;
      client.updatedAt = nowIso();
    }
  }

  appendTrashEntry(db, {
    entityType: "opportunity",
    entityId: opportunity.id,
    label: opportunity.nextStep ?? `Opportunity ${opportunity.id.slice(-6)}`,
    payload,
  });
}

export function moveProposalToTrash(db: SalesMachineDb, proposalId: string) {
  const proposal = db.proposalDocuments.find((entry) => entry.id === proposalId);

  if (!proposal) {
    throw new Error("Proposal not found.");
  }

  appendTrashEntry(db, {
    entityType: "proposal",
    entityId: proposal.id,
    label: proposal.title,
    payload: {
      proposalDocuments: filterPayload(
        takeWhere(db, "proposalDocuments", (entry) => entry.id === proposalId),
      ),
    },
  });
}

export function moveClientToTrash(db: SalesMachineDb, clientId: string) {
  const client = db.clients.find((entry) => entry.id === clientId);

  if (!client) {
    throw new Error("Client not found.");
  }

  appendTrashEntry(db, {
    entityType: "client",
    entityId: client.id,
    label: `Client ${client.id.slice(-6)}`,
    payload: detachClientCascade(db, new Set([clientId])),
  });
}

export function moveProjectToTrash(db: SalesMachineDb, projectId: string) {
  const project = db.clientProjects.find((entry) => entry.id === projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  appendTrashEntry(db, {
    entityType: "project",
    entityId: project.id,
    label: project.name,
    payload: detachProjectCascade(db, new Set([projectId])),
  });
}

export function moveReportToTrash(db: SalesMachineDb, reportId: string) {
  const report = db.monthlyReports.find((entry) => entry.id === reportId);

  if (!report) {
    throw new Error("Report not found.");
  }

  appendTrashEntry(db, {
    entityType: "report",
    entityId: report.id,
    label: report.title,
    payload: {
      monthlyReports: filterPayload(
        takeWhere(db, "monthlyReports", (entry) => entry.id === reportId),
      ),
    },
  });
}

function findSheetLabel(leads: Lead[], leadIds: Set<string>, sheetKey: string) {
  const matchedLead = leads.find((lead) => leadIds.has(lead.id));

  if (!matchedLead) {
    return sheetKey;
  }

  return `${matchedLead.niche} · ${matchedLead.locationLabel}`;
}

export function moveSheetToTrash(db: SalesMachineDb, sheetKey: string) {
  const deletedLeadIds = new Set(
    db.leads
      .filter((lead) => createSheetKey(lead.niche, lead.locationLabel) === sheetKey)
      .map((lead) => lead.id),
  );

  const deletedSearchRunIds = new Set(
    db.runs
      .filter((run) => run.kind === "lead-search")
      .filter((run) => {
        const niche = typeof run.input.niche === "string" ? run.input.niche.trim() : "";
        const location =
          typeof run.input.location === "string"
            ? run.input.location.trim()
            : typeof run.input.locationLabel === "string"
              ? run.input.locationLabel.trim()
              : "";

        return createSheetKey(niche, location) === sheetKey;
      })
      .map((run) => run.id),
  );

  if (!deletedLeadIds.size && !deletedSearchRunIds.size) {
    return;
  }

  const downstreamRunIds = new Set(
    db.runs
      .filter((run) => {
        const sourceRunId =
          typeof run.input.sourceRunId === "string" ? run.input.sourceRunId.trim() : "";

        return Boolean(sourceRunId && deletedSearchRunIds.has(sourceRunId));
      })
      .map((run) => run.id),
  );

  const touchedCampaignIds = new Set(
    db.campaignLeads
      .filter((campaignLead) => deletedLeadIds.has(campaignLead.leadId))
      .map((campaignLead) => campaignLead.campaignId),
  );
  const explicitCampaignIds = new Set(
    db.campaigns
      .filter(
        (campaign) =>
          campaign.sheetKey === sheetKey ||
          deletedSearchRunIds.has(campaign.sourceRunId ?? ""),
      )
      .map((campaign) => campaign.id),
  );

  const leadPayload = detachLeadCascade(db, deletedLeadIds);
  const runPayload = detachRunCascade(db, new Set([...deletedSearchRunIds, ...downstreamRunIds]));

  const orphanedCampaignIds = new Set(
    [...touchedCampaignIds].filter(
      (campaignId) => !db.campaignLeads.some((candidate) => candidate.campaignId === campaignId),
    ),
  );
  const campaignPayload = detachCampaignCascade(
    db,
    new Set([...explicitCampaignIds, ...orphanedCampaignIds]),
  );

  appendTrashEntry(db, {
    entityType: "sheet",
    entityId: sheetKey,
    label: findSheetLabel(leadPayload.leads ?? [], deletedLeadIds, sheetKey),
    payload: compactPayloadParts(leadPayload, runPayload, campaignPayload),
  });
}
