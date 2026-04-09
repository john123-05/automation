import { runSequenceGeneration } from "@/lib/sales-machine/outreach-workflows";
import { sendSequenceStep, addSuppressionEntry } from "@/lib/sales-machine/message-delivery";
import { mutateDb, readDb } from "@/lib/sales-machine/store";
import type {
  AuditScope,
  Campaign,
  CampaignLead,
  CampaignMetrics,
  GeneratedSequence,
  OutreachStateStatus,
  ServiceKey,
} from "@/lib/sales-machine/types";
import { createId, nowIso } from "@/lib/sales-machine/utils";
import { createSheetKey } from "@/lib/sales-machine/workspace-sheets";

type CreateCampaignInput = {
  name?: string | null;
  serviceKey: ServiceKey;
  sourceScope: AuditScope;
  sourceRunId: string | null;
  sheetKey: string | null;
  mailboxId: string | null;
  timezone?: string | null;
};

type UpdateCampaignStepInput = {
  campaignId: string;
  stepNumber: 1 | 2 | 3 | 4;
  subjectTemplate: string;
  bodyTemplate: string;
  dayOffset: number;
  enabled: boolean;
};

type UpdateCampaignScheduleInput = {
  campaignId: string;
  timezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  allowedWeekdays: number[];
  stopOnReply: boolean;
  waitHoursAfterFinalStep: number;
};

const stopStates = new Set<OutreachStateStatus>([
  "replied",
  "booked",
  "nurture",
  "closed",
  "no_show",
  "needs_escalation",
]);

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCampaignName({
  name,
  serviceKey,
  niche,
  locationLabel,
}: {
  name?: string | null;
  serviceKey: ServiceKey;
  niche?: string | null;
  locationLabel?: string | null;
}) {
  if (name?.trim()) {
    return name.trim();
  }

  if (niche && locationLabel) {
    return `${titleCase(niche)} · ${locationLabel}`;
  }

  return `${titleCase(serviceKey.replace(/_/g, " "))} Campaign`;
}

function getCampaignMetricsFromDb(db: Awaited<ReturnType<typeof readDb>>, campaignId: string): CampaignMetrics {
  const leads = db.campaignLeads.filter((candidate) => candidate.campaignId === campaignId);
  const sequences = db.generatedSequences.filter((candidate) => candidate.campaignId === campaignId);

  return {
    campaignId,
    leadCount: leads.length,
    draftedCount: leads.filter((candidate) => candidate.status === "drafted").length,
    approvedCount: sequences.filter((candidate) => candidate.state === "approved").length,
    scheduledCount: sequences.filter((candidate) => candidate.state === "scheduled").length,
    sentCount: sequences.filter((candidate) => candidate.state === "sent").length,
    repliedCount: leads.filter((candidate) => candidate.status === "replied").length,
    bookedCount: leads.filter((candidate) => candidate.status === "booked").length,
    nurtureCount: leads.filter((candidate) => candidate.status === "nurture").length,
    closedCount: leads.filter((candidate) => candidate.status === "closed").length,
    needsEscalationCount: leads.filter((candidate) => candidate.status === "needs_escalation").length,
  };
}

function nextAllowedDate(base: Date, campaign: Campaign, offsetDays: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);

  const [hours, minutes] = campaign.sendWindowStart.split(":").map((part) => Number.parseInt(part, 10));
  date.setHours(hours || 9, minutes || 0, 0, 0);

  const allowed = new Set(campaign.allowedWeekdays);

  while (!allowed.has(date.getDay())) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function syncCampaignLeadStatus(
  db: Awaited<ReturnType<typeof readDb>>,
  campaignId: string,
  leadId: string,
  nextStatus: CampaignLead["status"],
) {
  const campaignLead = db.campaignLeads.find(
    (candidate) => candidate.campaignId === campaignId && candidate.leadId === leadId,
  );

  if (!campaignLead) {
    return;
  }

  campaignLead.status = nextStatus;
  campaignLead.updatedAt = nowIso();
}

function getNextDueStep(sequence: GeneratedSequence) {
  return sequence.steps
    .filter((step) => step.sendState === "scheduled" && step.scheduledFor)
    .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))[0] ?? null;
}

export async function createCampaign(input: CreateCampaignInput) {
  const db = await readDb();
  const sampleLead =
    input.sheetKey
      ? db.leads.find((lead) => createSheetKey(lead.niche, lead.locationLabel) === input.sheetKey)
      : input.sourceRunId
        ? db.leads.find((lead) => lead.searchRunId === input.sourceRunId)
        : db.leads[0] ?? null;

  const campaignId = createId("campaign");
  const name = buildCampaignName({
    name: input.name,
    serviceKey: input.serviceKey,
    niche: sampleLead?.niche ?? null,
    locationLabel: sampleLead?.locationLabel ?? null,
  });

  await mutateDb((state) => {
    if (state.campaigns.some((candidate) => candidate.name === name && candidate.serviceKey === input.serviceKey)) {
      throw new Error("A campaign with this name already exists for that service.");
    }

    const timestamp = nowIso();
    state.campaigns.push({
      id: campaignId,
      name,
      serviceKey: input.serviceKey,
      status: "draft",
      sourceScope: input.sourceScope,
      sourceRunId: input.sourceRunId,
      sheetKey: input.sheetKey,
      mailboxId: input.mailboxId,
      timezone: input.timezone ?? "Europe/Madrid",
      sendWindowStart: "09:00",
      sendWindowEnd: "16:00",
      allowedWeekdays: [1, 2, 3, 4, 5],
      stopOnReply: true,
      waitHoursAfterFinalStep: 72,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    for (const template of state.sequenceTemplates.filter((template) => template.serviceKey === input.serviceKey)) {
      state.campaignSteps.push({
        id: `campaign_step_${campaignId}_${template.stepNumber}`,
        campaignId,
        stepNumber: template.stepNumber,
        dayOffset: template.dayOffset,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  });

  return campaignId;
}

export async function assignMailboxToCampaign(campaignId: string, mailboxId: string | null) {
  return mutateDb((db) => {
    const campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign) {
      throw new Error("Campaign was not found.");
    }

    campaign.mailboxId = mailboxId;
    campaign.updatedAt = nowIso();

    for (const sequence of db.generatedSequences.filter((candidate) => candidate.campaignId === campaignId)) {
      sequence.mailboxId = mailboxId;
      sequence.updatedAt = nowIso();
    }

    for (const state of db.outreachStates.filter((candidate) => candidate.campaignId === campaignId)) {
      state.mailboxId = mailboxId;
      state.updatedAt = nowIso();
    }
  });
}

export async function updateCampaignStep(input: UpdateCampaignStepInput) {
  return mutateDb((db) => {
    const step = db.campaignSteps.find(
      (candidate) =>
        candidate.campaignId === input.campaignId && candidate.stepNumber === input.stepNumber,
    );

    if (!step) {
      throw new Error("Campaign step was not found.");
    }

    step.subjectTemplate = input.subjectTemplate.trim();
    step.bodyTemplate = input.bodyTemplate.trim();
    step.dayOffset = input.dayOffset;
    step.enabled = input.enabled;
    step.updatedAt = nowIso();
  });
}

export async function updateCampaignSchedule(input: UpdateCampaignScheduleInput) {
  return mutateDb((db) => {
    const campaign = db.campaigns.find((candidate) => candidate.id === input.campaignId);

    if (!campaign) {
      throw new Error("Campaign was not found.");
    }

    campaign.timezone = input.timezone;
    campaign.sendWindowStart = input.sendWindowStart;
    campaign.sendWindowEnd = input.sendWindowEnd;
    campaign.allowedWeekdays = input.allowedWeekdays;
    campaign.stopOnReply = input.stopOnReply;
    campaign.waitHoursAfterFinalStep = input.waitHoursAfterFinalStep;
    campaign.updatedAt = nowIso();
  });
}

export async function approveCampaign(campaignId: string) {
  return mutateDb((db) => {
    let approvedCount = 0;

    for (const sequence of db.generatedSequences.filter((candidate) => candidate.campaignId === campaignId)) {
      sequence.state = "approved";
      sequence.approvedAt = nowIso();
      sequence.updatedAt = nowIso();
      sequence.steps = sequence.steps.map((step) => ({
        ...step,
        approvalState: "approved",
      }));
      approvedCount += 1;

      const outreachState = db.outreachStates.find((candidate) => candidate.sequenceId === sequence.id);
      if (outreachState) {
        outreachState.state = "approved";
        outreachState.nextStepNumber = 1;
        outreachState.updatedAt = nowIso();
        outreachState.lastActivityAt = nowIso();
      }

      syncCampaignLeadStatus(db, campaignId, sequence.leadId, "approved");
    }

    return approvedCount;
  });
}

function applyScheduleToSequence(sequence: GeneratedSequence, campaign: Campaign) {
  const base = sequence.approvedAt ? new Date(sequence.approvedAt) : new Date();
  let nextStepNumber: number | null = null;

  sequence.steps = sequence.steps.map((step) => {
    if (step.sendState === "sent") {
      return step;
    }

    const scheduledFor = nextAllowedDate(base, campaign, step.dayOffset).toISOString();

    if (nextStepNumber === null) {
      nextStepNumber = step.stepNumber;
    }

    return {
      ...step,
      sendState: "scheduled",
      scheduledFor,
    };
  });

  sequence.state = "scheduled";
  sequence.updatedAt = nowIso();

  return nextStepNumber;
}

export async function activateCampaign(campaignId: string) {
  return mutateDb((db) => {
    const campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign) {
      throw new Error("Campaign was not found.");
    }

    if (!campaign.mailboxId) {
      throw new Error("Assign a mailbox before activating the campaign.");
    }

    const mailbox = db.connectedMailboxes.find((candidate) => candidate.id === campaign.mailboxId);
    if (!mailbox || mailbox.status !== "connected") {
      throw new Error("Connect the assigned mailbox before activating the campaign.");
    }

    campaign.status = "active";
    campaign.updatedAt = nowIso();

    for (const sequence of db.generatedSequences.filter((candidate) => candidate.campaignId === campaignId)) {
      if (sequence.state !== "approved" && sequence.state !== "scheduled") {
        continue;
      }

      const nextStepNumber = applyScheduleToSequence(sequence, campaign);
      const outreachState = db.outreachStates.find((candidate) => candidate.sequenceId === sequence.id);

      if (outreachState) {
        outreachState.state = "scheduled";
        outreachState.nextStepNumber = nextStepNumber;
        outreachState.updatedAt = nowIso();
        outreachState.lastActivityAt = nowIso();
      }

      syncCampaignLeadStatus(db, campaignId, sequence.leadId, "scheduled");
    }
  });
}

export async function pauseCampaign(campaignId: string) {
  return mutateDb((db) => {
    const campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign) {
      throw new Error("Campaign was not found.");
    }

    campaign.status = "paused";
    campaign.updatedAt = nowIso();
  });
}

export async function regenerateCampaign(campaignId: string) {
  const db = await readDb();
  const campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

  if (!campaign) {
    throw new Error("Campaign was not found.");
  }

  return runSequenceGeneration({
    campaignId: campaign.id,
    serviceKey: campaign.serviceKey,
    scope: campaign.sourceScope,
    sourceRunId: campaign.sourceRunId,
    sheetKey: campaign.sheetKey,
    mailboxId: campaign.mailboxId,
    onlyUnsequenced: false,
  });
}

function threadLooksLikeBounce(subject: string, fromAddress: string | null) {
  const haystack = `${subject} ${fromAddress ?? ""}`.toLowerCase();
  return (
    haystack.includes("mailer-daemon") ||
    haystack.includes("delivery status notification") ||
    haystack.includes("undeliver") ||
    haystack.includes("postmaster")
  );
}

export async function maybeSuppressBounceRecipient(input: {
  toAddress: string | null;
  fromAddress: string | null;
  subject: string;
}) {
  if (!threadLooksLikeBounce(input.subject, input.fromAddress) || !input.toAddress) {
    return null;
  }

  return addSuppressionEntry({
    email: input.toAddress,
    reason: "Bounce-like mailbox response detected.",
    source: "bounce",
  });
}

export async function runCampaignScheduler() {
  const db = await readDb();
  const activeCampaigns = db.campaigns.filter((candidate) => candidate.status === "active");
  let sent = 0;
  let escalated = 0;

  for (const campaign of activeCampaigns) {
    for (const sequence of db.generatedSequences.filter((candidate) => candidate.campaignId === campaign.id)) {
      const outreachState = db.outreachStates.find((candidate) => candidate.sequenceId === sequence.id);
      if (outreachState && stopStates.has(outreachState.state)) {
        continue;
      }

      const nextDueStep = getNextDueStep(sequence);
      if (nextDueStep && nextDueStep.scheduledFor && new Date(nextDueStep.scheduledFor).getTime() <= Date.now()) {
        await sendSequenceStep(sequence.id, nextDueStep.stepNumber);
        sent += 1;
        continue;
      }

      const lastStep = sequence.steps.sort((a, b) => b.stepNumber - a.stepNumber)[0];
      if (
        lastStep?.sendState === "sent" &&
        lastStep.sentAt &&
        !stopStates.has(sequence.state) &&
        Date.now() - new Date(lastStep.sentAt).getTime() >= campaign.waitHoursAfterFinalStep * 60 * 60 * 1000
      ) {
        await mutateDb((state) => {
          const targetSequence = state.generatedSequences.find((candidate) => candidate.id === sequence.id);
          const targetState = state.outreachStates.find((candidate) => candidate.sequenceId === sequence.id);

          if (targetSequence) {
            targetSequence.state = "needs_escalation";
            targetSequence.updatedAt = nowIso();
          }

          if (targetState) {
            targetState.state = "needs_escalation";
            targetState.nextStepNumber = null;
            targetState.updatedAt = nowIso();
            targetState.lastActivityAt = nowIso();
          }

          syncCampaignLeadStatus(state, campaign.id, sequence.leadId, "needs_escalation");
        });
        escalated += 1;
      }
    }
  }

  return {
    campaignsChecked: activeCampaigns.length,
    sent,
    escalated,
  };
}

export async function getCampaignDetail(campaignId: string) {
  const db = await readDb();
  const campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

  if (!campaign) {
    throw new Error("Campaign was not found.");
  }

  return {
    campaign,
    steps: db.campaignSteps
      .filter((candidate) => candidate.campaignId === campaignId)
      .sort((a, b) => a.stepNumber - b.stepNumber),
    leads: db.campaignLeads
      .filter((candidate) => candidate.campaignId === campaignId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    metrics: getCampaignMetricsFromDb(db, campaignId),
  };
}
