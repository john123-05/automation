import { getEnv } from "@/lib/env";
import { normalizeEnvValue } from "@/lib/env-shared";
import { syncOpportunityFromOutreachStateInDb } from "@/lib/sales-machine/agency-os";
import { mutateDb, readDb } from "@/lib/sales-machine/store";
import { auditLeadWebsite } from "@/lib/sales-machine/website-audit";
import type {
  AuditRunInput,
  AuditRunResult,
  Contact,
  GeneratedSequence,
  GeneratedSequenceStep,
  Lead,
  ProspectOutreachState,
  SequenceGenerationInput,
  SequenceGenerationResult,
  WebsiteAuditJob,
  WorkflowRun,
  WorkflowStep,
} from "@/lib/sales-machine/types";
import { createId, nowIso, serializeError } from "@/lib/sales-machine/utils";
import { createSheetKey } from "@/lib/sales-machine/workspace-sheets";
import { sendRunCompletedAlert, sendRunFailedAlert } from "@/lib/sales-machine/run-alerts";

type SequenceApprovalInput = {
  sequenceIds: string[];
};

type UpdateGeneratedSequenceStepInput = {
  sequenceId: string;
  stepNumber: GeneratedSequenceStep["stepNumber"];
  subject: string;
  body: string;
};

type UpdateOutreachStateInput = {
  stateId: string;
  state: ProspectOutreachState["state"];
  notes?: string | null;
};

async function createRun(kind: WorkflowRun["kind"], input: WorkflowRun["input"]) {
  const run: WorkflowRun = {
    id: createId("run"),
    kind,
    status: "running",
    input,
    summary: null,
    error: null,
    startedAt: nowIso(),
    finishedAt: null,
    steps: [],
  };

  await mutateDb((db) => {
    db.runs.unshift(run);
  });

  return run;
}

async function addStep(runId: string, label: string, message: string) {
  const step: WorkflowStep = {
    id: createId("step"),
    label,
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    message,
    details: null,
  };

  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);

    if (!run) {
      throw new Error(`Run ${runId} was not found.`);
    }

    run.steps.push(step);
  });

  return step;
}

async function completeStep(runId: string, stepId: string, message: string, details?: string) {
  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);
    const step = run?.steps.find((candidate) => candidate.id === stepId);

    if (!run || !step) {
      throw new Error(`Step ${stepId} was not found.`);
    }

    step.status = "completed";
    step.message = message;
    step.details = details ?? null;
    step.finishedAt = nowIso();
  });
}

async function failStep(runId: string, stepId: string, message: string, details?: string) {
  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);
    const step = run?.steps.find((candidate) => candidate.id === stepId);

    if (!run || !step) {
      throw new Error(`Step ${stepId} was not found.`);
    }

    step.status = "failed";
    step.message = message;
    step.details = details ?? null;
    step.finishedAt = nowIso();
  });
}

async function finishRun(runId: string, summary: string) {
  let updatedRun: WorkflowRun | null = null;

  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);

    if (!run) {
      throw new Error(`Run ${runId} was not found.`);
    }

    run.status = "completed";
    run.summary = summary;
    run.finishedAt = nowIso();
    updatedRun = { ...run };
  });

  if (updatedRun) {
    await sendRunCompletedAlert(updatedRun, summary);
  }
}

async function failRun(runId: string, errorMessage: string) {
  let updatedRun: WorkflowRun | null = null;

  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);

    if (!run) {
      throw new Error(`Run ${runId} was not found.`);
    }

    const finishedAt = nowIso();

    for (const step of run.steps) {
      if (step.status === "running") {
        step.status = "failed";
        step.finishedAt = finishedAt;
        step.details = step.details ?? errorMessage;
      }
    }

    run.status = "failed";
    run.error = errorMessage;
    run.finishedAt = finishedAt;
    updatedRun = { ...run };
  });

  if (updatedRun) {
    await sendRunFailedAlert(updatedRun, errorMessage);
  }
}

async function createAuditJob(runId: string, input: AuditRunInput) {
  const job: WebsiteAuditJob = {
    id: createId("auditjob"),
    campaignId: input.campaignId ?? null,
    runId,
    serviceKey: input.serviceKey,
    scope: input.scope,
    sourceRunId: input.sourceRunId,
    sheetKey: input.sheetKey,
    batchSize: input.batchSize,
    status: "running",
    leadsClaimed: 0,
    leadsProcessed: 0,
    findingsCreated: 0,
    failedCount: 0,
    currentLeadId: null,
    currentLeadName: null,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
  };

  await mutateDb((db) => {
    db.auditJobs.unshift(job);
  });

  return job;
}

async function updateAuditJob(
  jobId: string,
  update: Partial<
    Pick<
      WebsiteAuditJob,
      | "leadsClaimed"
      | "leadsProcessed"
      | "findingsCreated"
      | "failedCount"
      | "currentLeadId"
      | "currentLeadName"
    >
  >,
) {
  await mutateDb((db) => {
    const job = db.auditJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Audit job ${jobId} was not found.`);
    }

    Object.assign(job, update);
    job.updatedAt = nowIso();
  });
}

async function finishAuditJob(jobId: string) {
  await mutateDb((db) => {
    const job = db.auditJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Audit job ${jobId} was not found.`);
    }

    job.status = "completed";
    job.currentLeadId = null;
    job.currentLeadName = null;
    job.error = null;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

async function failAuditJob(jobId: string, errorMessage: string) {
  await mutateDb((db) => {
    const job = db.auditJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      return;
    }

    job.status = "failed";
    job.error = errorMessage;
    job.currentLeadId = null;
    job.currentLeadName = null;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

function getBestContactForLead(contacts: Contact[], leadId: string) {
  const confidenceOrder = {
    high: 0,
    medium: 1,
    low: 2,
  } as const;

  return contacts
    .filter((contact) => contact.leadId === leadId)
    .sort((a, b) => {
      const emailScoreA = a.email ? 0 : 1;
      const emailScoreB = b.email ? 0 : 1;

      if (emailScoreA !== emailScoreB) {
        return emailScoreA - emailScoreB;
      }

      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    })[0] ?? null;
}

function matchesScope(
  lead: Lead,
  input: Pick<AuditRunInput, "scope" | "sheetKey" | "sourceRunId">,
) {
  if (input.scope === "run") {
    return Boolean(input.sourceRunId && lead.searchRunId === input.sourceRunId);
  }

  if (input.scope === "sheet") {
    return Boolean(
      input.sheetKey && createSheetKey(lead.niche, lead.locationLabel) === input.sheetKey,
    );
  }

  return true;
}

function renderTemplate(template: string, variables: Record<string, string | boolean | null>) {
  return template.replace(/\[([A-Z0-9_]+)\]/g, (_, key: string) => {
    const value = variables[key];

    if (typeof value === "boolean") {
      return value ? "yes" : "no";
    }

    return value ?? "";
  });
}

export async function runWebsiteAudit(input: AuditRunInput): Promise<AuditRunResult> {
  const run = await createRun("website-audit", input);
  let auditJobId: string | null = null;

  try {
    const queueStep = await addStep(
      run.id,
      "Build audit queue",
      "Selecting leads for the service-specific website audit lens.",
    );

    const auditJob = await createAuditJob(run.id, input);
    auditJobId = auditJob.id;

    const db = await readDb();
    const queuedLeads = db.leads
      .filter((lead) => matchesScope(lead, input))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, input.batchSize);

    await updateAuditJob(auditJob.id, {
      leadsClaimed: queuedLeads.length,
    });

    await completeStep(
      run.id,
      queueStep.id,
      queuedLeads.length
        ? `Queued ${queuedLeads.length} lead(s) for the ${input.serviceKey} audit lens.`
        : "No leads matched the selected audit scope.",
    );

    if (queuedLeads.length === 0) {
      await finishAuditJob(auditJob.id);
      await finishRun(run.id, "No leads matched the audit scope.");

      return {
        runId: run.id,
        jobId: auditJob.id,
        processed: 0,
        findingsCreated: 0,
        failed: 0,
      };
    }

    let processed = 0;
    let findingsCreated = 0;
    let failed = 0;

    for (const lead of queuedLeads) {
      await updateAuditJob(auditJob.id, {
        currentLeadId: lead.id,
        currentLeadName: lead.companyName,
      });

      const leadStep = await addStep(
        run.id,
        `Audit ${lead.companyName}`,
        `Checking the website through the ${input.serviceKey} lens.`,
      );

      try {
        const currentDb = await readDb();
        const bestContact = getBestContactForLead(currentDb.contacts, lead.id);
        const audit = await auditLeadWebsite({
          lead,
          serviceKey: input.serviceKey,
          contactName: bestContact?.name ?? null,
        });

        const findingId = `finding_${input.serviceKey}_${lead.id}`;
        const variablesId = `variables_${input.serviceKey}_${lead.id}`;

        const wasNew = await mutateDb((db) => {
          const existingFinding = db.auditFindings.find((candidate) => candidate.id === findingId);
          const existingVariables = db.prospectVariables.find(
            (candidate) => candidate.id === variablesId,
          );

          const findingPayload = {
            id: findingId,
            leadId: lead.id,
            serviceKey: input.serviceKey,
            jobId: auditJob.id,
            issueType: audit.finding.issueType,
            pageUrl: audit.finding.pageUrl,
            pageLabel: audit.finding.pageLabel,
            summary: audit.finding.summary,
            recognizableReason: audit.finding.recognizableReason,
            consequenceMechanics: audit.finding.consequenceMechanics,
            reviewTime: audit.finding.reviewTime,
            microYes: audit.finding.microYes,
            previewAssetExists: audit.finding.previewAssetExists,
            evidence: audit.finding.evidence,
            rawSignals: audit.finding.rawSignals,
            createdAt: existingFinding?.createdAt ?? nowIso(),
            updatedAt: nowIso(),
          };

          const variablesPayload = {
            id: variablesId,
            leadId: lead.id,
            serviceKey: input.serviceKey,
            findingId,
            contactId: bestContact?.id ?? null,
            variables: audit.variables,
            createdAt: existingVariables?.createdAt ?? nowIso(),
            updatedAt: nowIso(),
          };

          if (existingFinding) {
            Object.assign(existingFinding, findingPayload);
          } else {
            db.auditFindings.push(findingPayload);
          }

          if (existingVariables) {
            Object.assign(existingVariables, variablesPayload);
          } else {
            db.prospectVariables.push(variablesPayload);
          }

          const stateId = `outreach_${input.serviceKey}_${lead.id}`;
          const existingState = db.outreachStates.find((candidate) => candidate.id === stateId);

          if (!existingState) {
            db.outreachStates.push({
              id: stateId,
              campaignId: input.campaignId ?? null,
              leadId: lead.id,
              serviceKey: input.serviceKey,
              mailboxId: null,
              sequenceId: null,
              threadId: null,
              state: "drafted",
              nextStepNumber: 1,
              notes: null,
              lastActivityAt: nowIso(),
              createdAt: nowIso(),
              updatedAt: nowIso(),
            });
          } else {
            existingState.campaignId = input.campaignId ?? existingState.campaignId;
            existingState.lastActivityAt = nowIso();
            existingState.updatedAt = nowIso();
          }

          return !existingFinding;
        });

        processed += 1;
        findingsCreated += wasNew ? 1 : 0;

        await updateAuditJob(auditJob.id, {
          leadsProcessed: processed,
          findingsCreated,
          failedCount: failed,
        });

        await completeStep(
          run.id,
          leadStep.id,
          `Saved the primary ${input.serviceKey} finding for ${lead.companyName}.`,
          [
            `Issue: ${audit.finding.summary}`,
            `Reason: ${audit.finding.recognizableReason}`,
            `Page: ${audit.finding.pageLabel ?? audit.finding.pageUrl ?? "homepage"}`,
            ...audit.finding.evidence,
          ].join("\n"),
        );
      } catch (error) {
        processed += 1;
        failed += 1;

        await updateAuditJob(auditJob.id, {
          leadsProcessed: processed,
          findingsCreated,
          failedCount: failed,
        });

        await failStep(
          run.id,
          leadStep.id,
          `Audit failed for ${lead.companyName}.`,
          serializeError(error),
        );
      }
    }

    await finishAuditJob(auditJob.id);
    await finishRun(
      run.id,
      `Website audit finished: ${findingsCreated} new findings saved, ${failed} failed.`,
    );

    return {
      runId: run.id,
      jobId: auditJob.id,
      processed,
      findingsCreated,
      failed,
    };
  } catch (error) {
    if (auditJobId) {
      await failAuditJob(auditJobId, serializeError(error));
    }

    await failRun(run.id, serializeError(error));
    throw error;
  }
}

export async function runSequenceGeneration(
  input: SequenceGenerationInput,
): Promise<SequenceGenerationResult> {
  const run = await createRun("sequence-generation", input);

  try {
    const queueStep = await addStep(
      run.id,
      "Build generation queue",
      "Selecting audited leads and preparing the 4-step written-first cadence.",
    );

    const db = await readDb();
    const matchingFindingIds = new Set(
      db.auditFindings
        .filter((finding) => finding.serviceKey === input.serviceKey)
        .filter((finding) => {
          const lead = db.leads.find((candidate) => candidate.id === finding.leadId);

          if (!lead) {
            return false;
          }

          return matchesScope(lead, input);
        })
        .map((finding) => finding.id),
    );

    const queuedVariables = db.prospectVariables.filter(
      (variable) =>
        variable.serviceKey === input.serviceKey && matchingFindingIds.has(variable.findingId),
    );

    const eligibleVariables = input.onlyUnsequenced
      ? queuedVariables.filter(
          (variable) =>
            !db.generatedSequences.some(
              (sequence) =>
                sequence.leadId === variable.leadId && sequence.serviceKey === input.serviceKey,
            ),
        )
      : queuedVariables;

    await completeStep(
      run.id,
      queueStep.id,
      eligibleVariables.length
        ? `Queued ${eligibleVariables.length} lead(s) for sequence generation.`
        : "No audited leads matched the generation scope.",
    );

    if (eligibleVariables.length === 0) {
      await finishRun(run.id, "No audited leads matched the sequence scope.");
      return {
        runId: run.id,
        generated: 0,
        updated: 0,
      };
    }

    let generated = 0;
    let updated = 0;

    for (const variableSet of eligibleVariables) {
      const lead = db.leads.find((candidate) => candidate.id === variableSet.leadId);
      const finding = db.auditFindings.find((candidate) => candidate.id === variableSet.findingId);

      if (!lead || !finding) {
        continue;
      }

      const leadStep = await addStep(
        run.id,
        `Generate ${lead.companyName}`,
        "Rendering the 4-step written-first sequence from saved variables.",
      );

      const templates = db.sequenceTemplates
        .filter((template) => template.serviceKey === input.serviceKey)
        .sort((a, b) => a.stepNumber - b.stepNumber);
      const campaignTemplates = input.campaignId
        ? db.campaignSteps
            .filter((step) => step.campaignId === input.campaignId && step.enabled)
            .sort((a, b) => a.stepNumber - b.stepNumber)
        : [];

      const sourceTemplates = campaignTemplates.length ? campaignTemplates : templates;

      const renderedSteps: GeneratedSequenceStep[] = sourceTemplates.map((template) => ({
        stepNumber: template.stepNumber,
        dayOffset: template.dayOffset,
        subject: renderTemplate(template.subjectTemplate, variableSet.variables),
        body: renderTemplate(template.bodyTemplate, variableSet.variables),
        approvalState: "pending",
        sendState: "draft",
        scheduledFor: null,
        sentAt: null,
      }));

      const sequenceId = `sequence_${input.serviceKey}_${lead.id}`;
      const isNew = await mutateDb((db) => {
        const existingSequence = db.generatedSequences.find((candidate) => candidate.id === sequenceId);

        const payload: GeneratedSequence = {
          id: sequenceId,
          campaignId: input.campaignId ?? existingSequence?.campaignId ?? null,
          leadId: lead.id,
          serviceKey: input.serviceKey,
          findingId: finding.id,
          variablesId: variableSet.id,
          mailboxId: input.mailboxId,
          state: existingSequence?.state ?? "drafted",
          steps: renderedSteps,
          generatedAt: existingSequence?.generatedAt ?? nowIso(),
          approvedAt: existingSequence?.approvedAt ?? null,
          updatedAt: nowIso(),
        };

        if (existingSequence) {
          Object.assign(existingSequence, payload);
        } else {
          db.generatedSequences.push(payload);
        }

        const stateId = `outreach_${input.serviceKey}_${lead.id}`;
        const outreachState = db.outreachStates.find((candidate) => candidate.id === stateId);

        if (outreachState) {
          outreachState.campaignId = input.campaignId ?? outreachState.campaignId;
          outreachState.sequenceId = sequenceId;
          outreachState.mailboxId = input.mailboxId;
          outreachState.nextStepNumber = 1;
          outreachState.state = existingSequence?.state ?? "drafted";
          outreachState.lastActivityAt = nowIso();
          outreachState.updatedAt = nowIso();
        }

        if (input.campaignId) {
          const campaignLeadId = `campaign_lead_${input.campaignId}_${lead.id}`;
          const existingCampaignLead = db.campaignLeads.find(
            (candidate) => candidate.id === campaignLeadId,
          );

          if (existingCampaignLead) {
            existingCampaignLead.contactId = variableSet.contactId;
            existingCampaignLead.findingId = finding.id;
            existingCampaignLead.variablesId = variableSet.id;
            existingCampaignLead.sequenceId = sequenceId;
            existingCampaignLead.outreachStateId =
              outreachState?.id ?? existingCampaignLead.outreachStateId;
            existingCampaignLead.status = existingSequence?.state ?? "drafted";
            existingCampaignLead.updatedAt = nowIso();
          } else {
            db.campaignLeads.push({
              id: campaignLeadId,
              campaignId: input.campaignId,
              leadId: lead.id,
              contactId: variableSet.contactId,
              findingId: finding.id,
              variablesId: variableSet.id,
              sequenceId,
              outreachStateId: outreachState?.id ?? null,
              status: "drafted",
              createdAt: nowIso(),
              updatedAt: nowIso(),
            });
          }
        }

        return !existingSequence;
      });

      if (isNew) {
        generated += 1;
      } else {
        updated += 1;
      }

      await completeStep(
        run.id,
        leadStep.id,
        `Sequence ${isNew ? "generated" : "updated"} for ${lead.companyName}.`,
        renderedSteps
          .map((step) => `Day ${step.dayOffset + 1}: ${step.subject}`)
          .join("\n"),
      );
    }

    await finishRun(
      run.id,
      `Sequence generation finished: ${generated} new draft(s), ${updated} updated.`,
    );

    return {
      runId: run.id,
      generated,
      updated,
    };
  } catch (error) {
    await failRun(run.id, serializeError(error));
    throw error;
  }
}

export async function approveGeneratedSequences(input: SequenceApprovalInput) {
  if (input.sequenceIds.length === 0) {
    return 0;
  }

  return mutateDb((db) => {
    let approved = 0;

    for (const sequence of db.generatedSequences) {
      if (!input.sequenceIds.includes(sequence.id)) {
        continue;
      }

      sequence.state = "approved";
      sequence.approvedAt = nowIso();
      sequence.updatedAt = nowIso();
      sequence.steps = sequence.steps.map((step) => ({
        ...step,
        approvalState: "approved",
      }));
      approved += 1;

      const outreachState = db.outreachStates.find(
        (state) => state.sequenceId === sequence.id,
      );

      if (outreachState) {
        outreachState.state = "approved";
        outreachState.lastActivityAt = nowIso();
        outreachState.updatedAt = nowIso();
      }

      const campaignLead = db.campaignLeads.find((candidate) => candidate.sequenceId === sequence.id);
      if (campaignLead) {
        campaignLead.status = "approved";
        campaignLead.updatedAt = nowIso();
      }
    }

    return approved;
  });
}

export async function updateGeneratedSequenceStep(input: UpdateGeneratedSequenceStepInput) {
  return mutateDb((db) => {
    const sequence = db.generatedSequences.find((candidate) => candidate.id === input.sequenceId);

    if (!sequence) {
      throw new Error(`Sequence ${input.sequenceId} was not found.`);
    }

    const step = sequence.steps.find((candidate) => candidate.stepNumber === input.stepNumber);

    if (!step) {
      throw new Error(`Step ${input.stepNumber} was not found on sequence ${input.sequenceId}.`);
    }

    if (step.sendState === "sent") {
      throw new Error("Sent steps can no longer be edited.");
    }

    step.subject = input.subject.trim();
    step.body = input.body.trim();
    step.approvalState = "pending";

    if (sequence.state === "approved" || sequence.state === "scheduled") {
      const hasSentSteps = sequence.steps.some((candidate) => candidate.sendState === "sent");

      if (!hasSentSteps) {
        sequence.state = "drafted";
        sequence.approvedAt = null;
      }
    }

    sequence.updatedAt = nowIso();

    const outreachState = db.outreachStates.find((candidate) => candidate.sequenceId === sequence.id);

    if (
      outreachState &&
      (outreachState.state === "approved" ||
        outreachState.state === "scheduled" ||
        outreachState.state === "drafted")
    ) {
      outreachState.state = "drafted";
      outreachState.lastActivityAt = nowIso();
      outreachState.updatedAt = nowIso();
    }

    const campaignLead = db.campaignLeads.find((candidate) => candidate.sequenceId === sequence.id);
    if (campaignLead) {
      campaignLead.status = "drafted";
      campaignLead.updatedAt = nowIso();
    }

    return {
      sequenceId: sequence.id,
      stepNumber: step.stepNumber,
    };
  });
}

export async function updateOutreachState(input: UpdateOutreachStateInput) {
  return mutateDb((db) => {
    const state = db.outreachStates.find((candidate) => candidate.id === input.stateId);

    if (!state) {
      throw new Error(`Outreach state ${input.stateId} was not found.`);
    }

    state.state = input.state;
    state.notes = input.notes ?? state.notes;
    state.lastActivityAt = nowIso();
    state.updatedAt = nowIso();

    const sequence = state.sequenceId
      ? db.generatedSequences.find((candidate) => candidate.id === state.sequenceId)
      : null;

    if (sequence) {
      sequence.state = input.state;
      sequence.updatedAt = nowIso();
    }

    const thread = state.threadId
      ? db.emailThreads.find((candidate) => candidate.id === state.threadId)
      : null;

    if (thread) {
      thread.state = input.state;
      thread.updatedAt = nowIso();
    }

    const campaignLead = db.campaignLeads.find(
      (candidate) => candidate.outreachStateId === state.id || candidate.sequenceId === state.sequenceId,
    );
    if (campaignLead) {
      campaignLead.status = input.state;
      campaignLead.updatedAt = nowIso();
    }

    syncOpportunityFromOutreachStateInDb(db, {
      leadId: state.leadId,
      serviceKey: state.serviceKey,
      state: input.state,
      campaignId: state.campaignId,
      contactId: campaignLead?.contactId ?? null,
      occurredAt: state.lastActivityAt,
    });
  });
}

export async function getAuditProgressSnapshot() {
  const db = await readDb();
  const latestJob =
    [...db.auditJobs]
      .filter((job) => job.status === "running")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  if (!latestJob) {
    return null;
  }

  return {
    jobId: latestJob.id,
    runId: latestJob.runId,
    current: latestJob.leadsProcessed,
    total: latestJob.leadsClaimed,
    findingsCreated: latestJob.findingsCreated,
    failed: latestJob.failedCount,
    currentLeadName: latestJob.currentLeadName,
    percent:
      latestJob.leadsClaimed > 0
        ? Math.min(100, Math.round((latestJob.leadsProcessed / latestJob.leadsClaimed) * 100))
        : 0,
    detail: latestJob.currentLeadName
      ? `Auditing ${latestJob.currentLeadName}. ${latestJob.findingsCreated} finding(s) saved so far.`
      : `${latestJob.leadsProcessed} / ${latestJob.leadsClaimed} leads processed.`,
  };
}

export async function getMailboxConnectConfig() {
  const env = getEnv();

  return {
    clientId: normalizeEnvValue(process.env.GOOGLE_OAUTH_CLIENT_ID),
    clientSecret: normalizeEnvValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    redirectUri: normalizeEnvValue(process.env.GOOGLE_OAUTH_REDIRECT_URI),
    appUrl: normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL),
    hasGemini: Boolean(env.geminiApiKey),
  };
}
