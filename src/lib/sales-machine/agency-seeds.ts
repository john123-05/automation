import type {
  ClientProject,
  ProjectTask,
  ProposalTemplate,
  SalesMachineDb,
  ServiceKey,
  ServiceOfferProfile,
} from "@/lib/sales-machine/types";
import { nowIso } from "@/lib/sales-machine/utils";

type ProposalSeed = {
  serviceKey: ServiceKey;
  titleTemplate: string;
  bodyTemplate: string;
  offerProfile: {
    label: string;
    scopeDefaults: string;
    pricingNotes: string;
    objectionNotes: string;
  };
  defaultProjectTasks: string[];
};

const proposalSeeds: ProposalSeed[] = [
  {
    serviceKey: "seo",
    titleTemplate: "[COMPANY] · SEO Growth Sprint",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## Context\nI reviewed [PAGE] and noticed [WEBSITE_PROBLEM].\n\nThat matters because [CONSEQUENCE_MECHANICS], and it stood out because [RECOGNIZABLE_REASON].\n\n## Recommended SEO Work\n[SCOPE_DEFAULTS]\n\n## What we will fix first\n- Technical issue: [WEBSITE_PROBLEM]\n- Priority page: [PAGE]\n- Expected impact: [CONSEQUENCE_MECHANICS]\n\n## Delivery rhythm\n- Fast diagnostic and implementation plan\n- Priority fixes first\n- Ongoing refinement after launch\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nIf this looks relevant, I can turn this into the exact implementation roadmap.\n",
    offerProfile: {
      label: "SEO",
      scopeDefaults:
        "- sitemap, indexing, metadata, and page structure review\n- priority technical fixes\n- local/organic visibility improvement plan\n- monthly reporting and next-step recommendations",
      pricingNotes: "Typical SEO retainers start with a diagnostic sprint, then move into a monthly retainer.",
      objectionNotes: "Emphasize that small technical issues compound over time and affect both ranking and conversion.",
    },
    defaultProjectTasks: [
      "Collect Search Console and GA4 access",
      "Run technical SEO baseline review",
      "Prioritize homepage and service-page fixes",
      "Publish first round of technical/on-page improvements",
      "Set reporting baseline",
    ],
  },
  {
    serviceKey: "webdesign",
    titleTemplate: "[COMPANY] · Website Redesign Opportunity",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## What stood out\nOn [PAGE], I noticed [WEBSITE_PROBLEM].\n\nThat matters because [CONSEQUENCE_MECHANICS].\n\n## Recommended web design scope\n[SCOPE_DEFAULTS]\n\n## Initial priority\n- Fix the clarity / CTA issue on [PAGE]\n- Remove the friction caused by [WEBSITE_PROBLEM]\n- Build a clearer conversion path\n\n## Delivery rhythm\n- review and sitemap\n- revised messaging and layout\n- page build / refinement\n- QA and launch pass\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nIf useful, I can turn this into a page-by-page scope and timeline.\n",
    offerProfile: {
      label: "Web Design",
      scopeDefaults:
        "- homepage / service page redesign\n- CTA and trust flow improvements\n- content structure cleanup\n- responsive polish and conversion-focused QA",
      pricingNotes: "Web design work is usually scoped as a one-off project with phased review and launch.",
      objectionNotes: "Position redesign as a conversion and clarity fix, not only a visual refresh.",
    },
    defaultProjectTasks: [
      "Collect brand assets and references",
      "Audit current homepage and key pages",
      "Draft new page structure and CTA flow",
      "Design and implement updated pages",
      "Run launch QA and mobile checks",
    ],
  },
  {
    serviceKey: "copywriting",
    titleTemplate: "[COMPANY] · Conversion Copy Refresh",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## Problem observed\nI noticed [WEBSITE_PROBLEM] on [PAGE], which is likely affecting clarity because [CONSEQUENCE_MECHANICS].\n\n## Recommended copy scope\n[SCOPE_DEFAULTS]\n\n## Priority rewrite focus\n- sharpen headline and message hierarchy\n- improve offer clarity on [PAGE]\n- tighten CTA language and trust framing\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nIf helpful, I can draft the first rewritten section to show the direction.\n",
    offerProfile: {
      label: "Copywriting",
      scopeDefaults:
        "- homepage / service page rewrite\n- clearer messaging hierarchy\n- offer and CTA refinement\n- proof positioning and trust language",
      pricingNotes: "Copywriting can be scoped as a one-off rewrite or attached to web design / SEO delivery.",
      objectionNotes: "Keep it outcome-focused: better message clarity means better conversions from current traffic.",
    },
    defaultProjectTasks: [
      "Collect current copy and positioning notes",
      "Audit headline, offer, and CTA clarity",
      "Draft revised messaging structure",
      "Deliver first-pass rewrites",
      "Refine after review",
    ],
  },
  {
    serviceKey: "ai_automation",
    titleTemplate: "[COMPANY] · Automation Workflow Proposal",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## Workflow signal\nI noticed [WEBSITE_PROBLEM] on [PAGE], which often points to [CONSEQUENCE_MECHANICS].\n\n## Recommended automation scope\n[SCOPE_DEFAULTS]\n\n## First automation targets\n- remove manual friction around [PAGE]\n- improve response speed and lead handling\n- document a cleaner internal workflow\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nI can map the first workflow and show where the quickest automation win is.\n",
    offerProfile: {
      label: "AI Automation",
      scopeDefaults:
        "- workflow discovery and friction mapping\n- automation opportunity design\n- system setup / implementation\n- reporting and iteration after launch",
      pricingNotes: "Automation projects usually start with a discovery/fix sprint, then expand into retained optimization.",
      objectionNotes: "Frame automation as saved time and faster lead handling, not as AI for its own sake.",
    },
    defaultProjectTasks: [
      "Map current workflow and bottlenecks",
      "Define first automation use case",
      "Build and test the workflow",
      "Document fallback/manual process",
      "Hand off operating notes",
    ],
  },
  {
    serviceKey: "marketing",
    titleTemplate: "[COMPANY] · Marketing Conversion Plan",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## Opportunity\nI noticed [WEBSITE_PROBLEM] on [PAGE]. The main reason it matters is [CONSEQUENCE_MECHANICS].\n\n## Recommended marketing scope\n[SCOPE_DEFAULTS]\n\n## First wins\n- clarify the offer\n- improve trust and proof\n- make the next step easier to take\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nIf relevant, I can turn this into a short roadmap with quick wins and monthly focus areas.\n",
    offerProfile: {
      label: "Marketing",
      scopeDefaults:
        "- offer clarity review\n- trust / positioning improvements\n- landing-page conversion optimization\n- monthly campaign and messaging recommendations",
      pricingNotes: "Marketing retainers often blend offer strategy, page refinement, and ongoing reporting.",
      objectionNotes: "Tie marketing recommendations back to conversion friction already visible on the website.",
    },
    defaultProjectTasks: [
      "Review offer and current conversion path",
      "Prioritize proof and positioning fixes",
      "Ship first landing-page improvements",
      "Create monthly optimization cadence",
      "Review results and next focus",
    ],
  },
  {
    serviceKey: "lead_capture",
    titleTemplate: "[COMPANY] · Lead Capture Improvement Plan",
    bodyTemplate:
      "# Proposal for [COMPANY]\n\n## What I noticed\n[WEBSITE_PROBLEM] on [PAGE] likely affects lead capture because [CONSEQUENCE_MECHANICS].\n\n## Recommended lead capture scope\n[SCOPE_DEFAULTS]\n\n## Priority fixes\n- strengthen CTA visibility\n- reduce form/contact friction\n- improve inquiry flow and response readiness\n\n## Investment note\n[PRICING_NOTES]\n\n## Next step\nI can show the quickest changes likely to lift inquiries first.\n",
    offerProfile: {
      label: "Lead Capture",
      scopeDefaults:
        "- CTA and contact path audit\n- form flow improvements\n- inquiry response optimization\n- conversion tracking and monthly refinement",
      pricingNotes: "Lead capture work can be run as a focused sprint or rolled into a monthly optimization retainer.",
      objectionNotes: "Keep the pitch focused on reducing lost inquiries from existing traffic.",
    },
    defaultProjectTasks: [
      "Audit CTA and form flow",
      "Map current inquiry path",
      "Implement first conversion fixes",
      "Set baseline lead tracking",
      "Review inquiry quality after launch",
    ],
  },
];

export function getDefaultProposalTemplates(): ProposalTemplate[] {
  const timestamp = nowIso();

  return proposalSeeds.map((seed) => ({
    id: `proposal_template_${seed.serviceKey}`,
    serviceKey: seed.serviceKey,
    titleTemplate: seed.titleTemplate,
    bodyTemplate: seed.bodyTemplate,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export function getDefaultServiceOfferProfiles(): ServiceOfferProfile[] {
  const timestamp = nowIso();

  return proposalSeeds.map((seed) => ({
    id: `service_offer_${seed.serviceKey}`,
    serviceKey: seed.serviceKey,
    label: seed.offerProfile.label,
    scopeDefaults: seed.offerProfile.scopeDefaults,
    pricingNotes: seed.offerProfile.pricingNotes,
    objectionNotes: seed.offerProfile.objectionNotes,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export function getDefaultProjectTaskTemplates(serviceKey: ServiceKey) {
  const seed = proposalSeeds.find((candidate) => candidate.serviceKey === serviceKey);
  return seed?.defaultProjectTasks ?? [
    "Kick off the project",
    "Ship the first milestone",
    "Review results and next actions",
  ];
}

export function ensureAgencySeedData(db: SalesMachineDb) {
  const now = nowIso();
  const existingProposalIds = new Set(db.proposalTemplates.map((item) => item.id));
  const existingOfferIds = new Set(db.serviceOfferProfiles.map((item) => item.id));

  for (const template of getDefaultProposalTemplates()) {
    if (existingProposalIds.has(template.id)) {
      continue;
    }

    db.proposalTemplates.push({
      ...template,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const profile of getDefaultServiceOfferProfiles()) {
    if (existingOfferIds.has(profile.id)) {
      continue;
    }

    db.serviceOfferProfiles.push({
      ...profile,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function seedDefaultProjectTasks(
  project: ClientProject,
  taskFactory: (title: string, sortOrder: number) => ProjectTask,
) {
  return getDefaultProjectTaskTemplates(project.serviceKey).map((title, index) =>
    taskFactory(title, index),
  );
}
