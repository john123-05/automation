"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addActivityNote,
  createClientFromOpportunity,
  createClientProject,
  createMeeting,
  createReminder,
  createReportingConnection,
  generateMonthlyReport,
  generateProposal,
  requestClientAsset,
  updateOpportunityStage,
  updateProjectTask,
  updateProposalStatus,
  upsertOpportunity,
} from "@/lib/sales-machine/agency-os";
import { mutateDb } from "@/lib/sales-machine/store";
import {
  createSheetKey,
  getSheetKeyFromRun,
} from "@/lib/sales-machine/workspace-sheets";
import { runContactEnrichment, runLeadSearch } from "@/lib/sales-machine/workflows";
import type { Contact, FormState } from "@/lib/sales-machine/types";
import { serializeError } from "@/lib/sales-machine/utils";

const searchSchema = z.object({
  niche: z.string().trim().min(2, "Give the search a clearer niche."),
  location: z.string().trim().min(2, "Give the search a location."),
  radiusMeters: z
    .number()
    .int()
    .min(100, "Radius must be at least 100 meters.")
    .max(50000, "Radius must stay under 50,000 meters."),
  maxLeads: z
    .number()
    .int()
    .min(1, "Max leads must be at least 1.")
    .max(500, "Max leads must stay under 500."),
  searchMode: z.enum(["capped", "exhaustive"]),
});

const enrichSchema = z.object({
  batchSize: z
    .number()
    .int()
    .min(1, "Batch size must be at least 1.")
    .max(50, "Batch size must stay under 50."),
  includePreviouslyFailed: z.boolean(),
  allowOpenAiSecondPass: z.boolean(),
  scope: z.enum(["run", "all-pending"]),
  sourceRunId: z.string().trim().min(1).nullable(),
});

const initialState: FormState = {
  status: "idle",
  message: "",
};

const renameSheetSchema = z.object({
  sheetKey: z.string().trim().min(1),
  sheetLabel: z.string().trim().min(2).max(80),
});

const updateLeadCrmSchema = z.object({
  leadId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).nullable(),
  priority: z.enum(["low", "medium", "high"]),
  nextAction: z
    .enum([
      "review_audit",
      "approve_sequence",
      "send_now",
      "reply",
      "book_meeting",
      "follow_up_later",
    ])
    .nullable(),
  nextActionDueAt: z.string().trim().nullable(),
  ownerLabel: z.string().trim().max(80).nullable(),
  archived: z.boolean(),
  returnPath: z.string().trim().min(1),
});

const bulkLeadCrmSchema = z.object({
  action: z.enum(["set_priority", "set_next_action", "archive"]),
  priority: z.enum(["low", "medium", "high"]).nullable(),
  nextAction: z
    .enum([
      "review_audit",
      "approve_sequence",
      "send_now",
      "reply",
      "book_meeting",
      "follow_up_later",
    ])
    .nullable(),
  returnPath: z.string().trim().min(1),
});

const addContactSchema = z.object({
  leadId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(120).nullable(),
  email: z.string().trim().email().nullable(),
  linkedin: z.string().trim().max(300).nullable(),
  instagram: z.string().trim().max(300).nullable(),
  twitter: z.string().trim().max(300).nullable(),
  facebook: z.string().trim().max(300).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  returnPath: z.string().trim().min(1),
});

const addCompanySchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  address: z.string().trim().min(2).max(240),
  websiteUri: z.string().trim().url().nullable(),
  nationalPhoneNumber: z.string().trim().max(80).nullable(),
  internationalPhoneNumber: z.string().trim().max(80).nullable(),
  niche: z.string().trim().min(2).max(120),
  locationLabel: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).nullable(),
  contactTitle: z.string().trim().max(120).nullable(),
  contactEmail: z.string().trim().email().nullable(),
  contactLinkedin: z.string().trim().max(300).nullable(),
  contactConfidence: z.enum(["high", "medium", "low"]),
  returnPath: z.string().trim().min(1),
});

const opportunitySchema = z.object({
  leadId: z.string().trim().min(1),
  contactId: z.string().trim().nullable(),
  serviceKey: z.enum(["seo", "webdesign", "copywriting", "ai_automation", "marketing", "lead_capture"]),
  sourceCampaignId: z.string().trim().nullable(),
  estimatedValueUsd: z.coerce.number().nullable(),
  closeProbability: z.coerce.number().nullable(),
  nextStep: z.string().trim().nullable(),
  nextStepDueAt: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const opportunityStageSchema = z.object({
  opportunityId: z.string().trim().min(1),
  stage: z.enum(["new", "qualified", "meeting_booked", "proposal_drafted", "proposal_sent", "won", "lost", "nurture"]),
  status: z.enum(["open", "won", "lost", "nurture"]).nullable(),
  nextStep: z.string().trim().nullable(),
  nextStepDueAt: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const meetingSchema = z.object({
  leadId: z.string().trim().min(1),
  opportunityId: z.string().trim().nullable(),
  contactId: z.string().trim().nullable(),
  scheduledAt: z.string().trim().min(1),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  agenda: z.string().trim().nullable(),
  prepNotes: z.string().trim().nullable(),
  outcome: z.string().trim().nullable(),
  followUpDueAt: z.string().trim().nullable(),
  status: z.enum(["planned", "completed", "no_show", "cancelled"]),
  returnPath: z.string().trim().min(1),
});

const proposalGenerateSchema = z.object({
  opportunityId: z.string().trim().min(1),
  amountUsd: z.coerce.number().nullable(),
  returnPath: z.string().trim().min(1),
});

const proposalStatusSchema = z.object({
  proposalId: z.string().trim().min(1),
  status: z.enum(["draft", "sent", "accepted", "lost"]),
  returnPath: z.string().trim().min(1),
});

const clientConvertSchema = z.object({
  opportunityId: z.string().trim().min(1),
  startDate: z.string().trim().nullable(),
  retainerType: z.enum(["one_off", "monthly", "quarterly", "project"]),
  billingCycle: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const projectSchema = z.object({
  clientId: z.string().trim().min(1),
  serviceKey: z.enum(["seo", "webdesign", "copywriting", "ai_automation", "marketing", "lead_capture"]),
  name: z.string().trim().min(2),
  startDate: z.string().trim().nullable(),
  targetDate: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const projectTaskSchema = z.object({
  taskId: z.string().trim().min(1),
  status: z.enum(["todo", "in_progress", "done"]),
  title: z.string().trim().nullable(),
  dueAt: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const reminderSchema = z.object({
  title: z.string().trim().min(2),
  dueAt: z.string().trim().min(1),
  leadId: z.string().trim().nullable(),
  opportunityId: z.string().trim().nullable(),
  clientId: z.string().trim().nullable(),
  projectId: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const activityNoteSchema = z.object({
  entityType: z.enum(["lead", "opportunity", "client", "project"]),
  entityId: z.string().trim().min(1),
  body: z.string().trim().min(2),
  leadId: z.string().trim().nullable(),
  clientId: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

const reportingConnectionSchema = z.object({
  clientId: z.string().trim().min(1),
  kind: z.enum(["search_console", "ga4", "pagespeed"]),
  target: z.string().trim().min(1),
  status: z.enum(["setup_needed", "connected", "error"]).nullable(),
  returnPath: z.string().trim().min(1),
});

const monthlyReportSchema = z.object({
  clientId: z.string().trim().min(1),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  returnPath: z.string().trim().min(1),
});

const assetRequestSchema = z.object({
  clientId: z.string().trim().min(1),
  type: z.string().trim().min(2),
  description: z.string().trim().nullable(),
  returnPath: z.string().trim().min(1),
});

function touchLeadContactState(db: Parameters<typeof mutateDb>[0] extends (db: infer T) => unknown ? T : never, leadId: string) {
  const lead = db.leads.find((entry) => entry.id === leadId);

  if (!lead) {
    return;
  }

  const count = db.contacts.filter((contact) => contact.leadId === leadId).length;
  lead.contactCount = count;
  lead.updatedAt = new Date().toISOString();

  if (count > 0 && lead.stage !== "error") {
    lead.stage = "enriched";
  }
}

function upsertContact(
  db: Parameters<typeof mutateDb>[0] extends (db: infer T) => unknown ? T : never,
  input: {
    leadId: string;
    name: string;
    title: string | null;
    email: string | null;
    linkedin: string | null;
    instagram: string | null;
    twitter: string | null;
    facebook: string | null;
    confidence: Contact["confidence"];
    source: Contact["source"];
  },
) {
  const now = new Date().toISOString();
  const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
  const normalizedName = input.name.trim().toLowerCase();
  const existing = db.contacts.find((contact) => {
    if (contact.leadId !== input.leadId) {
      return false;
    }

    const sameEmail =
      normalizedEmail &&
      contact.email &&
      contact.email.trim().toLowerCase() === normalizedEmail;

    const sameName = contact.name.trim().toLowerCase() === normalizedName;
    return Boolean(sameEmail || sameName);
  });

  if (existing) {
    existing.name = input.name.trim();
    existing.title = input.title;
    existing.email = input.email;
    existing.linkedin = input.linkedin;
    existing.instagram = input.instagram;
    existing.twitter = input.twitter;
    existing.facebook = input.facebook;
    existing.confidence = input.confidence;
    existing.source = input.source;
    existing.discoveredAt = now;
    touchLeadContactState(db, input.leadId);
    return;
  }

  db.contacts.push({
    id: `contact_${crypto.randomUUID()}`,
    leadId: input.leadId,
    name: input.name.trim(),
    title: input.title,
    email: input.email,
    linkedin: input.linkedin,
    instagram: input.instagram,
    twitter: input.twitter,
    facebook: input.facebook,
    confidence: input.confidence,
    source: input.source,
    discoveredAt: now,
  });

  touchLeadContactState(db, input.leadId);
}

function upsertLead(
  db: Parameters<typeof mutateDb>[0] extends (db: infer T) => unknown ? T : never,
  input: {
    companyName: string;
    address: string;
    websiteUri: string | null;
    nationalPhoneNumber: string | null;
    internationalPhoneNumber: string | null;
    niche: string;
    locationLabel: string;
    source: "manual-entry" | "csv-import";
  },
) {
  const now = new Date().toISOString();
  const existing = db.leads.find(
    (lead) =>
      lead.companyName.trim().toLowerCase() === input.companyName.trim().toLowerCase() &&
      lead.locationLabel.trim().toLowerCase() === input.locationLabel.trim().toLowerCase(),
  );

  if (existing) {
    existing.address = input.address.trim();
    existing.websiteUri = input.websiteUri;
    existing.nationalPhoneNumber = input.nationalPhoneNumber;
    existing.internationalPhoneNumber = input.internationalPhoneNumber;
    existing.niche = input.niche.trim();
    existing.locationLabel = input.locationLabel.trim();
    existing.source = input.source;
    existing.updatedAt = now;
    return existing;
  }

  const lead = {
    id: `lead_${crypto.randomUUID()}`,
    companyName: input.companyName.trim(),
    address: input.address.trim(),
    websiteUri: input.websiteUri,
    rating: null,
    nationalPhoneNumber: input.nationalPhoneNumber,
    internationalPhoneNumber: input.internationalPhoneNumber,
    latitude: null,
    longitude: null,
    niche: input.niche.trim(),
    locationLabel: input.locationLabel.trim(),
    source: input.source,
    stage: "discovered" as const,
    personSearched: false,
    contactCount: 0,
    researchSummary: null,
    lastError: null,
    searchRunId: null,
    discoveredAt: now,
    updatedAt: now,
  };

  db.leads.push(lead);
  return lead;
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export async function searchLeadsAction(
  previousState: FormState = initialState,
  formData: FormData,
): Promise<FormState> {
  void previousState;
  const payload = searchSchema.safeParse({
    niche: formData.get("niche"),
    location: formData.get("location"),
    radiusMeters: Number(formData.get("radiusMeters")),
    maxLeads: Number(formData.get("maxLeads")),
    searchMode:
      formData.get("searchMode") === "exhaustive" ? "exhaustive" : "capped",
  });

  if (!payload.success) {
    return {
      status: "error",
      message: payload.error.issues[0]?.message ?? "Lead search form is invalid.",
    };
  }

  try {
    const result = await runLeadSearch(payload.data);
    revalidatePath("/");

    return {
      status: "success",
      message:
        payload.data.searchMode === "exhaustive"
          ? `Lead search finished in exhaustive mode. ${result.inserted} new leads saved, ${result.updated} refreshed.`
          : `Lead search finished. ${result.inserted} new leads saved, ${result.updated} refreshed.`,
      runId: result.runId,
    };
  } catch (error) {
    return {
      status: "error",
      message: serializeError(error),
    };
  }
}

export async function enrichLeadsAction(
  previousState: FormState = initialState,
  formData: FormData,
): Promise<FormState> {
  void previousState;
  const payload = enrichSchema.safeParse({
    batchSize: Number(formData.get("batchSize")),
    includePreviouslyFailed: formData.get("includePreviouslyFailed") === "on",
    allowOpenAiSecondPass: formData.get("allowOpenAiSecondPass") === "on",
    scope: formData.get("scope") === "all-pending" ? "all-pending" : "run",
    sourceRunId: formData.get("sourceRunId")
      ? String(formData.get("sourceRunId"))
      : null,
  });

  if (!payload.success) {
    return {
      status: "error",
      message: payload.error.issues[0]?.message ?? "Enrichment form is invalid.",
    };
  }

  if (payload.data.scope === "run" && !payload.data.sourceRunId) {
    return {
      status: "error",
      message: "Pick a lead-search run or switch the scope to all pending leads.",
    };
  }

  try {
    const result = await runContactEnrichment(payload.data);
    revalidatePath("/");

    return {
      status: "success",
      message: `Enrichment finished. ${result.enriched} enriched, ${result.missing} missing, ${result.failed} failed.${payload.data.allowOpenAiSecondPass ? " Gemini ran first, then OpenAI retried the no-match leads." : " Gemini ran first without an OpenAI retry pass."}`,
      runId: result.runId,
    };
  } catch (error) {
    return {
      status: "error",
      message: serializeError(error),
    };
  }
}

export async function deleteRunAction(runId: string) {
  await mutateDb((db) => {
    db.runs = db.runs.filter((run) => run.id !== runId);
    db.searchJobs = db.searchJobs.filter((job) => job.runId !== runId);
    db.enrichmentJobs = db.enrichmentJobs.filter((job) => job.runId !== runId);
    const deletedAuditJobIds = new Set(
      db.auditJobs.filter((job) => job.runId === runId).map((job) => job.id),
    );
    db.auditJobs = db.auditJobs.filter((job) => job.runId !== runId);
    db.auditFindings = db.auditFindings.filter((finding) => !deletedAuditJobIds.has(finding.jobId));
  });

  revalidatePath("/");
  revalidatePath("/workspace");
  revalidatePath("/outreach");
}

export async function renameSheetAction(formData: FormData) {
  const payload = renameSheetSchema.parse({
    sheetKey: formData.get("sheetKey"),
    sheetLabel: formData.get("sheetLabel"),
  });

  await mutateDb((db) => {
    for (const run of db.runs) {
      if (run.kind !== "lead-search") {
        continue;
      }

      if (getSheetKeyFromRun(run) !== payload.sheetKey) {
        continue;
      }

      run.input = {
        ...run.input,
        sheetLabel: payload.sheetLabel,
      };
    }
  });

  revalidatePath("/workspace");
  redirect(`/workspace?sheet=${encodeURIComponent(payload.sheetKey)}`);
}

export async function deleteSheetAction(sheetKey: string) {
  await mutateDb((db) => {
    const deletedLeadIds = new Set(
      db.leads
        .filter((lead) => {
          return createSheetKey(lead.niche, lead.locationLabel) === sheetKey;
        })
        .map((lead) => lead.id),
    );

    const deletedSearchRunIds = new Set(
      db.runs
        .filter((run) => run.kind === "lead-search" && getSheetKeyFromRun(run) === sheetKey)
        .map((run) => run.id),
    );

    db.leads = db.leads.filter((lead) => !deletedLeadIds.has(lead.id));
    db.contacts = db.contacts.filter((contact) => !deletedLeadIds.has(contact.leadId));
    db.runs = db.runs.filter((run) => {
      if (run.kind === "lead-search") {
        return getSheetKeyFromRun(run) !== sheetKey;
      }

      const sourceRunId =
        typeof run.input.sourceRunId === "string" ? run.input.sourceRunId.trim() : null;
      const scope = run.input.scope === "all-pending" ? "all-pending" : "run";

      if (scope === "run" && sourceRunId && deletedSearchRunIds.has(sourceRunId)) {
        return false;
      }

      return true;
    });
    db.searchJobs = db.searchJobs.filter((job) => !deletedSearchRunIds.has(job.runId));
    db.enrichmentJobs = db.enrichmentJobs.filter((job) => {
      const relatedRun = db.runs.find((run) => run.id === job.runId);
      return Boolean(relatedRun);
    });
    const deletedAuditJobIds = new Set(
      db.auditJobs
        .filter((job) => {
          if (job.sheetKey === sheetKey) {
            return true;
          }

          return Boolean(job.sourceRunId && deletedSearchRunIds.has(job.sourceRunId));
        })
        .map((job) => job.id),
    );
    const deletedSequenceIds = new Set(
      db.generatedSequences
        .filter((sequence) => deletedLeadIds.has(sequence.leadId))
        .map((sequence) => sequence.id),
    );
    const deletedThreadIds = new Set(
      db.emailThreads
        .filter((thread) => deletedLeadIds.has(thread.leadId ?? ""))
        .map((thread) => thread.id),
    );
    db.auditJobs = db.auditJobs.filter((job) => !deletedAuditJobIds.has(job.id));
    db.auditFindings = db.auditFindings.filter(
      (finding) => !deletedLeadIds.has(finding.leadId) && !deletedAuditJobIds.has(finding.jobId),
    );
    db.prospectVariables = db.prospectVariables.filter(
      (variable) => !deletedLeadIds.has(variable.leadId),
    );
    db.generatedSequences = db.generatedSequences.filter(
      (sequence) => !deletedLeadIds.has(sequence.leadId),
    );
    db.outreachStates = db.outreachStates.filter(
      (state) =>
        !deletedLeadIds.has(state.leadId) &&
        !deletedSequenceIds.has(state.sequenceId ?? "") &&
        !deletedThreadIds.has(state.threadId ?? ""),
    );
    db.emailThreads = db.emailThreads.filter((thread) => !deletedThreadIds.has(thread.id));
    db.emailMessages = db.emailMessages.filter(
      (message) => !deletedThreadIds.has(message.threadId),
    );
  });

  revalidatePath("/workspace");
  revalidatePath("/outreach");
  redirect("/workspace");
}

export async function updateLeadCrmAction(formData: FormData) {
  const payload = updateLeadCrmSchema.parse({
    leadId: formData.get("leadId"),
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    priority:
      formData.get("priority") === "low"
        ? "low"
        : formData.get("priority") === "high"
          ? "high"
          : "medium",
    nextAction: formData.get("nextAction") ? String(formData.get("nextAction")).trim() : null,
    nextActionDueAt: formData.get("nextActionDueAt")
      ? String(formData.get("nextActionDueAt")).trim()
      : null,
    ownerLabel: formData.get("ownerLabel") ? String(formData.get("ownerLabel")).trim() : null,
    archived: formData.get("archived") === "on",
    returnPath: formData.get("returnPath"),
  });

  await mutateDb((db) => {
    const existing = db.leadCrmMetadata.find((entry) => entry.leadId === payload.leadId);
    const now = new Date().toISOString();

    if (existing) {
      existing.notes = payload.notes || null;
      existing.priority = payload.priority;
      existing.nextAction = payload.nextAction || null;
      existing.nextActionDueAt = payload.nextActionDueAt || null;
      existing.ownerLabel = payload.ownerLabel || null;
      existing.archivedAt = payload.archived ? now : null;
      existing.updatedAt = now;
      return;
    }

    db.leadCrmMetadata.push({
      id: `lead_crm_${crypto.randomUUID()}`,
      leadId: payload.leadId,
      notes: payload.notes || null,
      priority: payload.priority,
      nextAction: payload.nextAction || null,
      nextActionDueAt: payload.nextActionDueAt || null,
      ownerLabel: payload.ownerLabel || null,
      archivedAt: payload.archived ? now : null,
      updatedAt: now,
    });
  });

  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function bulkUpdateLeadCrmAction(formData: FormData) {
  const leadIds = formData
    .getAll("leadIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!leadIds.length) {
    redirect(String(formData.get("returnPath") || "/workspace"));
  }

  const payload = bulkLeadCrmSchema.parse({
    action: formData.get("action"),
    priority: formData.get("priority") ? String(formData.get("priority")).trim() : null,
    nextAction: formData.get("nextAction") ? String(formData.get("nextAction")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await mutateDb((db) => {
    const now = new Date().toISOString();

    for (const leadId of leadIds) {
      let existing = db.leadCrmMetadata.find((entry) => entry.leadId === leadId);

      if (!existing) {
        existing = {
          id: `lead_crm_${crypto.randomUUID()}`,
          leadId,
          notes: null,
          priority: "medium",
          nextAction: null,
          nextActionDueAt: null,
          ownerLabel: null,
          archivedAt: null,
          updatedAt: now,
        };
        db.leadCrmMetadata.push(existing);
      }

      if (payload.action === "set_priority" && payload.priority) {
        existing.priority = payload.priority;
      }

      if (payload.action === "set_next_action") {
        existing.nextAction = payload.nextAction;
      }

      if (payload.action === "archive") {
        existing.archivedAt = now;
      }

      existing.updatedAt = now;
    }
  });

  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function addManualContactAction(formData: FormData) {
  const payload = addContactSchema.parse({
    leadId: formData.get("leadId"),
    name: formData.get("name"),
    title: formData.get("title") ? String(formData.get("title")).trim() : null,
    email: formData.get("email") ? String(formData.get("email")).trim() : null,
    linkedin: formData.get("linkedin") ? String(formData.get("linkedin")).trim() : null,
    instagram: formData.get("instagram") ? String(formData.get("instagram")).trim() : null,
    twitter: formData.get("twitter") ? String(formData.get("twitter")).trim() : null,
    facebook: formData.get("facebook") ? String(formData.get("facebook")).trim() : null,
    confidence:
      formData.get("confidence") === "high"
        ? "high"
        : formData.get("confidence") === "low"
          ? "low"
          : "medium",
    returnPath: formData.get("returnPath"),
  });

  await mutateDb((db) => {
    upsertContact(db, {
      leadId: payload.leadId,
      name: payload.name,
      title: payload.title || null,
      email: payload.email || null,
      linkedin: payload.linkedin || null,
      instagram: payload.instagram || null,
      twitter: payload.twitter || null,
      facebook: payload.facebook || null,
      confidence: payload.confidence,
      source: "manual-entry",
    });
  });

  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function importContactsCsvAction(formData: FormData) {
  const file = formData.get("file");
  const returnPath = String(formData.get("returnPath") || "/workspace");

  if (!(file instanceof File) || file.size === 0) {
    redirect(returnPath);
  }

  const csvText = await file.text();
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    redirect(returnPath);
  }

  const headers = rows[0].map((cell) => cell.trim().toLowerCase());
  const dataRows = rows.slice(1);

  await mutateDb((db) => {
    for (const row of dataRows) {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      const leadId = record.lead_id?.trim() || "";
      const companyName = record.company_name?.trim() || record.company?.trim() || "";
      const lead =
        (leadId ? db.leads.find((entry) => entry.id === leadId) : null) ??
        (companyName
          ? db.leads.find((entry) => entry.companyName.trim().toLowerCase() === companyName.toLowerCase())
          : null);

      const name = record.name?.trim() || "";
      if (!lead || !name) {
        continue;
      }

      const confidenceValue = (record.confidence?.trim().toLowerCase() || "medium") as Contact["confidence"];
      const confidence: Contact["confidence"] =
        confidenceValue === "high" || confidenceValue === "low" ? confidenceValue : "medium";

      upsertContact(db, {
        leadId: lead.id,
        name,
        title: record.title?.trim() || null,
        email: record.email?.trim() || null,
        linkedin: record.linkedin?.trim() || null,
        instagram: record.instagram?.trim() || null,
        twitter: record.twitter?.trim() || null,
        facebook: record.facebook?.trim() || null,
        confidence,
        source: "csv-import",
      });
    }
  });

  revalidatePath("/workspace");
  redirect(returnPath);
}

export async function addCompanyAction(formData: FormData) {
  const payload = addCompanySchema.parse({
    companyName: formData.get("companyName"),
    address: formData.get("address"),
    websiteUri: formData.get("websiteUri") ? String(formData.get("websiteUri")).trim() : null,
    nationalPhoneNumber: formData.get("nationalPhoneNumber")
      ? String(formData.get("nationalPhoneNumber")).trim()
      : null,
    internationalPhoneNumber: formData.get("internationalPhoneNumber")
      ? String(formData.get("internationalPhoneNumber")).trim()
      : null,
    niche: formData.get("niche"),
    locationLabel: formData.get("locationLabel"),
    contactName: formData.get("contactName") ? String(formData.get("contactName")).trim() : null,
    contactTitle: formData.get("contactTitle") ? String(formData.get("contactTitle")).trim() : null,
    contactEmail: formData.get("contactEmail") ? String(formData.get("contactEmail")).trim() : null,
    contactLinkedin: formData.get("contactLinkedin")
      ? String(formData.get("contactLinkedin")).trim()
      : null,
    contactConfidence:
      formData.get("contactConfidence") === "high"
        ? "high"
        : formData.get("contactConfidence") === "low"
          ? "low"
          : "medium",
    returnPath: formData.get("returnPath"),
  });

  await mutateDb((db) => {
    const lead = upsertLead(db, {
      companyName: payload.companyName,
      address: payload.address,
      websiteUri: payload.websiteUri || null,
      nationalPhoneNumber: payload.nationalPhoneNumber || null,
      internationalPhoneNumber: payload.internationalPhoneNumber || null,
      niche: payload.niche,
      locationLabel: payload.locationLabel,
      source: "manual-entry",
    });

    if (payload.contactName) {
      upsertContact(db, {
        leadId: lead.id,
        name: payload.contactName,
        title: payload.contactTitle || null,
        email: payload.contactEmail || null,
        linkedin: payload.contactLinkedin || null,
        instagram: null,
        twitter: null,
        facebook: null,
        confidence: payload.contactConfidence,
        source: "manual-entry",
      });
    }
  });

  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function createOpportunityAction(formData: FormData) {
  const payload = opportunitySchema.parse({
    leadId: formData.get("leadId"),
    contactId: formData.get("contactId") ? String(formData.get("contactId")).trim() : null,
    serviceKey: formData.get("serviceKey"),
    sourceCampaignId: formData.get("sourceCampaignId") ? String(formData.get("sourceCampaignId")).trim() : null,
    estimatedValueUsd: formData.get("estimatedValueUsd") ? Number(formData.get("estimatedValueUsd")) : null,
    closeProbability: formData.get("closeProbability") ? Number(formData.get("closeProbability")) : null,
    nextStep: formData.get("nextStep") ? String(formData.get("nextStep")).trim() : null,
    nextStepDueAt: formData.get("nextStepDueAt") ? String(formData.get("nextStepDueAt")).trim() : null,
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await upsertOpportunity(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function updateOpportunityStageAction(formData: FormData) {
  const payload = opportunityStageSchema.parse({
    opportunityId: formData.get("opportunityId"),
    stage: formData.get("stage"),
    status: formData.get("status") ? String(formData.get("status")).trim() : null,
    nextStep: formData.get("nextStep") ? String(formData.get("nextStep")).trim() : null,
    nextStepDueAt: formData.get("nextStepDueAt") ? String(formData.get("nextStepDueAt")).trim() : null,
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await updateOpportunityStage({
    opportunityId: payload.opportunityId,
    stage: payload.stage,
    status: payload.status ?? undefined,
    nextStep: payload.nextStep ?? null,
    nextStepDueAt: payload.nextStepDueAt ?? null,
    notes: payload.notes ?? null,
  });
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function createMeetingAction(formData: FormData) {
  const payload = meetingSchema.parse({
    leadId: formData.get("leadId"),
    opportunityId: formData.get("opportunityId") ? String(formData.get("opportunityId")).trim() : null,
    contactId: formData.get("contactId") ? String(formData.get("contactId")).trim() : null,
    scheduledAt: formData.get("scheduledAt"),
    durationMinutes: Number(formData.get("durationMinutes") || 30),
    agenda: formData.get("agenda") ? String(formData.get("agenda")).trim() : null,
    prepNotes: formData.get("prepNotes") ? String(formData.get("prepNotes")).trim() : null,
    outcome: formData.get("outcome") ? String(formData.get("outcome")).trim() : null,
    followUpDueAt: formData.get("followUpDueAt") ? String(formData.get("followUpDueAt")).trim() : null,
    status: formData.get("status") || "planned",
    returnPath: formData.get("returnPath"),
  });

  await createMeeting(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function generateProposalAction(formData: FormData) {
  const payload = proposalGenerateSchema.parse({
    opportunityId: formData.get("opportunityId"),
    amountUsd: formData.get("amountUsd") ? Number(formData.get("amountUsd")) : null,
    returnPath: formData.get("returnPath"),
  });

  await generateProposal(payload);
  revalidatePath("/workspace");
  revalidatePath("/outreach");
  redirect(payload.returnPath);
}

export async function updateProposalStatusAction(formData: FormData) {
  const payload = proposalStatusSchema.parse({
    proposalId: formData.get("proposalId"),
    status: formData.get("status"),
    returnPath: formData.get("returnPath"),
  });

  await updateProposalStatus(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function convertOpportunityToClientAction(formData: FormData) {
  const payload = clientConvertSchema.parse({
    opportunityId: formData.get("opportunityId"),
    startDate: formData.get("startDate") ? String(formData.get("startDate")).trim() : null,
    retainerType: formData.get("retainerType") || "project",
    billingCycle: formData.get("billingCycle") ? String(formData.get("billingCycle")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await createClientFromOpportunity(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function createProjectAction(formData: FormData) {
  const payload = projectSchema.parse({
    clientId: formData.get("clientId"),
    serviceKey: formData.get("serviceKey"),
    name: formData.get("name"),
    startDate: formData.get("startDate") ? String(formData.get("startDate")).trim() : null,
    targetDate: formData.get("targetDate") ? String(formData.get("targetDate")).trim() : null,
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await createClientProject(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function updateProjectTaskAction(formData: FormData) {
  const payload = projectTaskSchema.parse({
    taskId: formData.get("taskId"),
    status: formData.get("status"),
    title: formData.get("title") ? String(formData.get("title")).trim() : null,
    dueAt: formData.get("dueAt") ? String(formData.get("dueAt")).trim() : null,
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await updateProjectTask(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function createReminderAction(formData: FormData) {
  const payload = reminderSchema.parse({
    title: formData.get("title"),
    dueAt: formData.get("dueAt"),
    leadId: formData.get("leadId") ? String(formData.get("leadId")).trim() : null,
    opportunityId: formData.get("opportunityId") ? String(formData.get("opportunityId")).trim() : null,
    clientId: formData.get("clientId") ? String(formData.get("clientId")).trim() : null,
    projectId: formData.get("projectId") ? String(formData.get("projectId")).trim() : null,
    notes: formData.get("notes") ? String(formData.get("notes")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await createReminder(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function addActivityNoteAction(formData: FormData) {
  const payload = activityNoteSchema.parse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    body: formData.get("body"),
    leadId: formData.get("leadId") ? String(formData.get("leadId")).trim() : null,
    clientId: formData.get("clientId") ? String(formData.get("clientId")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await addActivityNote(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function createReportingConnectionAction(formData: FormData) {
  const payload = reportingConnectionSchema.parse({
    clientId: formData.get("clientId"),
    kind: formData.get("kind"),
    target: formData.get("target"),
    status: formData.get("status") ? String(formData.get("status")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await createReportingConnection({
    clientId: payload.clientId,
    kind: payload.kind,
    target: payload.target,
    status: payload.status ?? undefined,
  });
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function generateMonthlyReportAction(formData: FormData) {
  const payload = monthlyReportSchema.parse({
    clientId: formData.get("clientId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    returnPath: formData.get("returnPath"),
  });

  await generateMonthlyReport(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}

export async function requestClientAssetAction(formData: FormData) {
  const payload = assetRequestSchema.parse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
    description: formData.get("description") ? String(formData.get("description")).trim() : null,
    returnPath: formData.get("returnPath"),
  });

  await requestClientAsset(payload);
  revalidatePath("/workspace");
  redirect(payload.returnPath);
}
