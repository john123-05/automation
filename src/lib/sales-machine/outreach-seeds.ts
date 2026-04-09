import type {
  CampaignStatus,
  GeneratedSequence,
  SalesMachineDb,
  SequenceTemplate,
  ServiceKey,
  ServiceProfile,
} from "@/lib/sales-machine/types";
import { nowIso } from "@/lib/sales-machine/utils";
import { createSheetKey } from "@/lib/sales-machine/workspace-sheets";

type ServiceSeed = {
  serviceKey: ServiceKey;
  label: string;
  shortDescription: string;
  auditRules: string[];
  sequence: Array<{
    stepNumber: 1 | 2 | 3 | 4;
    dayOffset: number;
    subjectTemplate: string;
    bodyTemplate: string;
  }>;
};

const serviceSeeds: ServiceSeed[] = [
  {
    serviceKey: "seo",
    label: "SEO",
    shortDescription: "Find crawl, sitemap, metadata, and on-page issues worth mentioning.",
    auditRules: [
      "sitemap",
      "robots",
      "title",
      "meta_description",
      "h1",
      "canonical",
      "internal_links",
    ],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI noticed [WEBSITE_PROBLEM] on [PAGE], and that matters because [CONSEQUENCE_MECHANICS].\n\nIt stood out quickly because [RECOGNIZABLE_REASON].\n\nIf helpful, I can send over [REVIEW_TIME] with the exact fix path.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Quick follow-up on [COMPANY]",
        bodyTemplate:
          "[NAME],\n\nCircling back on [WEBSITE_PROBLEM]. If that page is meant to rank or convert, [CONSEQUENCE_MECHANICS].\n\nHappy to send the short review when useful.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "Worth fixing on [COMPANY]'s site?",
        bodyTemplate:
          "[NAME],\n\nThis is the same issue I spotted on [PAGE]. Most teams leave it because it looks small, but [CONSEQUENCE_MECHANICS].\n\nI can point out the exact change in a short walkthrough.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Close the loop on [COMPANY]",
        bodyTemplate:
          "[NAME],\n\nLast note from me. I flagged [WEBSITE_PROBLEM] and can send the short breakdown if it helps, otherwise I will close the loop here.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
  {
    serviceKey: "webdesign",
    label: "Web Design",
    shortDescription: "Find UX, clarity, trust, and conversion friction on the homepage.",
    auditRules: ["headline", "cta", "trust", "contact_path", "forms", "page_clarity"],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI landed on [PAGE] and noticed [WEBSITE_PROBLEM]. It matters because [CONSEQUENCE_MECHANICS].\n\nThe reason it jumped out is [RECOGNIZABLE_REASON].\n\nI can send a quick [REVIEW_TIME] with how I would tighten it up.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Re: [COMPANY] website note",
        bodyTemplate:
          "[NAME],\n\nFollowing up on the issue I saw on [PAGE]. Small clarity or CTA fixes usually change how many visitors actually take the next step.\n\nIf you want, I can send the short review.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "One more thought on [COMPANY]'s site",
        bodyTemplate:
          "[NAME],\n\nThe same [WEBSITE_PROBLEM] is probably costing attention because [CONSEQUENCE_MECHANICS].\n\nI already noted the exact page and fix angle, so I can send it over in a compact review.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Should I close this out?",
        bodyTemplate:
          "[NAME],\n\nLast follow-up from me. If improving [PAGE] is relevant, I can send the short design review. Otherwise I will leave you to it.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
  {
    serviceKey: "copywriting",
    label: "Copywriting",
    shortDescription: "Find weak headline, offer, message-match, and clarity issues.",
    auditRules: ["headline", "value_prop", "offer_clarity", "cta"],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI noticed [WEBSITE_PROBLEM] on [PAGE], which matters because [CONSEQUENCE_MECHANICS].\n\nIt stood out because [RECOGNIZABLE_REASON].\n\nI can send a short [REVIEW_TIME] with how I would tighten the copy.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Quick copy note for [COMPANY]",
        bodyTemplate:
          "[NAME],\n\nFollowing up because the wording on [PAGE] may be hiding the value of what [COMPANY] does.\n\nIf useful, I can send the small copy pass I had in mind.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "Still worth seeing?",
        bodyTemplate:
          "[NAME],\n\nThis is the same point about [WEBSITE_PROBLEM]. Usually it is not a traffic issue first, it is a message clarity issue.\n\nI can send the short rewrite idea if helpful.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Closing the loop on the copy note",
        bodyTemplate:
          "[NAME],\n\nLast note from me. If a sharper message on [PAGE] would help, I can send the quick review and then get out of your way.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
  {
    serviceKey: "ai_automation",
    label: "AI Automation",
    shortDescription: "Find manual lead handling, slow workflows, and missing automation cues.",
    auditRules: ["contact_path", "manual_process", "forms", "cta"],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI noticed [WEBSITE_PROBLEM] on [PAGE], which usually points to [CONSEQUENCE_MECHANICS].\n\nIt stood out because [RECOGNIZABLE_REASON].\n\nI can send a short [REVIEW_TIME] showing how I would automate that path.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Follow-up on the workflow gap",
        bodyTemplate:
          "[NAME],\n\nFollowing up because the issue on [PAGE] looks like a fixable workflow bottleneck, not just a website nitpick.\n\nIf helpful, I can outline the automation angle.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "Would this help [COMPANY]?",
        bodyTemplate:
          "[NAME],\n\nStill thinking about [WEBSITE_PROBLEM]. Teams usually keep that process manual longer than they need to, and [CONSEQUENCE_MECHANICS].\n\nI can send the fast outline if useful.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Should I close the automation idea?",
        bodyTemplate:
          "[NAME],\n\nLast note from me. If you want the quick automation review for [PAGE], I can send it. Otherwise I will close this out here.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
  {
    serviceKey: "marketing",
    label: "Marketing",
    shortDescription: "Find offer, proof, and positioning gaps that reduce conversion.",
    auditRules: ["offer_clarity", "social_proof", "cta", "headline"],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI noticed [WEBSITE_PROBLEM] on [PAGE]. It matters because [CONSEQUENCE_MECHANICS].\n\nWhat made it recognizable was [RECOGNIZABLE_REASON].\n\nI can send a short [REVIEW_TIME] with how I would tighten the marketing angle.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Marketing note for [COMPANY]",
        bodyTemplate:
          "[NAME],\n\nFollowing up because [WEBSITE_PROBLEM] is usually more of a conversion or positioning problem than a design problem.\n\nHappy to send the short review if useful.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "Still relevant for [COMPANY]?",
        bodyTemplate:
          "[NAME],\n\nThe same issue on [PAGE] is probably making the offer harder to trust or act on.\n\nI already sketched the review angle if you want it.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Close the loop?",
        bodyTemplate:
          "[NAME],\n\nLast follow-up from me. If seeing the short marketing review helps, I can send it over. Otherwise I will stop here.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
  {
    serviceKey: "lead_capture",
    label: "Lead Capture",
    shortDescription: "Find missed CTA, form, and inquiry-handling opportunities.",
    auditRules: ["cta", "forms", "contact_path", "offer_clarity"],
    sequence: [
      {
        stepNumber: 1,
        dayOffset: 0,
        subjectTemplate: "[SUBJECT_LINE]",
        bodyTemplate:
          "[NAME],\n\nI noticed [WEBSITE_PROBLEM] on [PAGE], and it matters because [CONSEQUENCE_MECHANICS].\n\nIt stood out because [RECOGNIZABLE_REASON].\n\nI can send a short [REVIEW_TIME] with the lead-capture fixes I would make first.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 2,
        dayOffset: 2,
        subjectTemplate: "Quick note on [COMPANY]'s inquiry flow",
        bodyTemplate:
          "[NAME],\n\nFollowing up because the issue on [PAGE] looks like it could be leaking ready-to-act leads.\n\nI can send the quick review if it would help.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 3,
        dayOffset: 4,
        subjectTemplate: "Worth fixing on the lead-capture side?",
        bodyTemplate:
          "[NAME],\n\nStill thinking about [WEBSITE_PROBLEM]. Even small CTA or form fixes tend to matter when [CONSEQUENCE_MECHANICS].\n\nI can send the short breakdown if useful.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
      {
        stepNumber: 4,
        dayOffset: 6,
        subjectTemplate: "Should I close this out?",
        bodyTemplate:
          "[NAME],\n\nLast note from me. If you want the quick lead-capture review for [PAGE], I can send it. Otherwise I will close the loop here.\n\n[MICRO_YES]\n\n[YOUR_NAME]",
      },
    ],
  },
];

export function getDefaultServiceProfiles(): ServiceProfile[] {
  const timestamp = nowIso();

  return serviceSeeds.map((seed) => ({
    id: `service_${seed.serviceKey}`,
    serviceKey: seed.serviceKey,
    label: seed.label,
    shortDescription: seed.shortDescription,
    auditRules: seed.auditRules,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export function getDefaultSequenceTemplates(): SequenceTemplate[] {
  const timestamp = nowIso();

  return serviceSeeds.flatMap((seed) =>
    seed.sequence.map((step) => ({
      id: `template_${seed.serviceKey}_${step.stepNumber}`,
      serviceKey: seed.serviceKey,
      stepNumber: step.stepNumber,
      dayOffset: step.dayOffset,
      subjectTemplate: step.subjectTemplate,
      bodyTemplate: step.bodyTemplate,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
}

export function ensureOutreachSeedData(db: SalesMachineDb) {
  const now = nowIso();
  const profileIds = new Set(db.serviceProfiles.map((profile) => profile.id));
  const templateIds = new Set(db.sequenceTemplates.map((template) => template.id));

  for (const profile of getDefaultServiceProfiles()) {
    if (profileIds.has(profile.id)) {
      continue;
    }

    db.serviceProfiles.push({
      ...profile,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const template of getDefaultSequenceTemplates()) {
    if (templateIds.has(template.id)) {
      continue;
    }

    db.sequenceTemplates.push({
      ...template,
      createdAt: now,
      updatedAt: now,
    });
  }

  ensureCampaignData(db);
}

export function getServiceProfileMeta(serviceKey: ServiceKey) {
  return serviceSeeds.find((seed) => seed.serviceKey === serviceKey) ?? serviceSeeds[0];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveCampaignId(serviceKey: ServiceKey, sheetKey: string) {
  return `campaign_${serviceKey}_${sheetKey}`;
}

function deriveCampaignName(niche: string, locationLabel: string) {
  return `${titleCase(niche)} · ${locationLabel}`;
}

function deriveCampaignStatus(sequence: GeneratedSequence | undefined): CampaignStatus {
  if (!sequence) {
    return "draft";
  }

  if (sequence.state === "scheduled" || sequence.state === "sent") {
    return "active";
  }

  if (
    sequence.state === "replied" ||
    sequence.state === "booked" ||
    sequence.state === "nurture" ||
    sequence.state === "closed" ||
    sequence.state === "needs_escalation" ||
    sequence.state === "no_show"
  ) {
    return "completed";
  }

  return "draft";
}

function ensureCampaignSteps(
  db: SalesMachineDb,
  campaignId: string,
  serviceKey: ServiceKey,
  timestamp: string,
) {
  const existingIds = new Set(
    db.campaignSteps
      .filter((step) => step.campaignId === campaignId)
      .map((step) => step.stepNumber),
  );

  for (const template of db.sequenceTemplates.filter((template) => template.serviceKey === serviceKey)) {
    if (existingIds.has(template.stepNumber)) {
      continue;
    }

    db.campaignSteps.push({
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
}

function ensureCampaignData(db: SalesMachineDb) {
  const timestamp = nowIso();
  const contactByLead = new Map(
    db.contacts
      .slice()
      .sort((a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)))
      .map((contact) => [contact.leadId, contact]),
  );

  const leadById = new Map(db.leads.map((lead) => [lead.id, lead]));
  const findingByLeadAndService = new Map(
    db.auditFindings.map((finding) => [`${finding.leadId}:${finding.serviceKey}`, finding]),
  );
  const variablesByLeadAndService = new Map(
    db.prospectVariables.map((variables) => [`${variables.leadId}:${variables.serviceKey}`, variables]),
  );
  const stateByLeadAndService = new Map(
    db.outreachStates.map((state) => [`${state.leadId}:${state.serviceKey}`, state]),
  );

  const groupedItems = new Map<
    string,
    {
      leadId: string;
      serviceKey: ServiceKey;
      sequence?: GeneratedSequence;
    }[]
  >();

  for (const finding of db.auditFindings) {
    const lead = leadById.get(finding.leadId);
    if (!lead) continue;
    const sheetKey = createSheetKey(lead.niche, lead.locationLabel);
    const groupKey = `${finding.serviceKey}:${sheetKey}`;
    const existing = groupedItems.get(groupKey) ?? [];
    if (!existing.some((item) => item.leadId === finding.leadId && item.serviceKey === finding.serviceKey)) {
      existing.push({ leadId: finding.leadId, serviceKey: finding.serviceKey });
      groupedItems.set(groupKey, existing);
    }
  }

  for (const sequence of db.generatedSequences) {
    const lead = leadById.get(sequence.leadId);
    if (!lead) continue;
    const sheetKey = createSheetKey(lead.niche, lead.locationLabel);
    const groupKey = `${sequence.serviceKey}:${sheetKey}`;
    const existing = groupedItems.get(groupKey) ?? [];
    const match = existing.find((item) => item.leadId === sequence.leadId && item.serviceKey === sequence.serviceKey);

    if (match) {
      match.sequence = sequence;
    } else {
      existing.push({ leadId: sequence.leadId, serviceKey: sequence.serviceKey, sequence });
    }

    groupedItems.set(groupKey, existing);
  }

  for (const [groupKey, items] of groupedItems.entries()) {
    const [serviceKey, sheetKey] = groupKey.split(":") as [ServiceKey, string];
    const sampleLead = leadById.get(items[0]?.leadId ?? "");

    if (!sampleLead) {
      continue;
    }

    const campaignId = deriveCampaignId(serviceKey, sheetKey);
    let campaign = db.campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign) {
      const sequence = items.find((item) => item.sequence)?.sequence;
      campaign = {
        id: campaignId,
        name: deriveCampaignName(sampleLead.niche, sampleLead.locationLabel),
        serviceKey,
        status: deriveCampaignStatus(sequence),
        sourceScope: "sheet",
        sourceRunId: sampleLead.searchRunId,
        sheetKey,
        mailboxId: sequence?.mailboxId ?? null,
        timezone: "Europe/Madrid",
        sendWindowStart: "09:00",
        sendWindowEnd: "16:00",
        allowedWeekdays: [1, 2, 3, 4, 5],
        stopOnReply: true,
        waitHoursAfterFinalStep: 72,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      db.campaigns.push(campaign);
    }

    ensureCampaignSteps(db, campaign.id, serviceKey, timestamp);

    for (const item of items) {
      const lead = leadById.get(item.leadId);
      if (!lead) continue;

      const finding = findingByLeadAndService.get(`${lead.id}:${serviceKey}`);
      const variables = variablesByLeadAndService.get(`${lead.id}:${serviceKey}`);
      const state = stateByLeadAndService.get(`${lead.id}:${serviceKey}`);
      const contact = contactByLead.get(lead.id);
      const campaignLeadId = `campaign_lead_${campaign.id}_${lead.id}`;
      const existingCampaignLead = db.campaignLeads.find((candidate) => candidate.id === campaignLeadId);
      const nextStatus = state?.state ?? item.sequence?.state ?? (finding ? "audited" : "drafted");

      if (!existingCampaignLead) {
        db.campaignLeads.push({
          id: campaignLeadId,
          campaignId: campaign.id,
          leadId: lead.id,
          contactId: contact?.id ?? null,
          findingId: finding?.id ?? null,
          variablesId: variables?.id ?? null,
          sequenceId: item.sequence?.id ?? null,
          outreachStateId: state?.id ?? null,
          status: nextStatus,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } else {
        existingCampaignLead.contactId = contact?.id ?? existingCampaignLead.contactId;
        existingCampaignLead.findingId = finding?.id ?? existingCampaignLead.findingId;
        existingCampaignLead.variablesId = variables?.id ?? existingCampaignLead.variablesId;
        existingCampaignLead.sequenceId = item.sequence?.id ?? existingCampaignLead.sequenceId;
        existingCampaignLead.outreachStateId = state?.id ?? existingCampaignLead.outreachStateId;
        existingCampaignLead.status = nextStatus;
        existingCampaignLead.updatedAt = timestamp;
      }

      if (item.sequence && !item.sequence.campaignId) {
        item.sequence.campaignId = campaign.id;
      }

      if (state && !state.campaignId) {
        state.campaignId = campaign.id;
      }

      for (const thread of db.emailThreads) {
        if (
          thread.leadId === lead.id &&
          thread.serviceKey === serviceKey &&
          !thread.campaignId
        ) {
          thread.campaignId = campaign.id;
        }
      }
    }
  }
}
