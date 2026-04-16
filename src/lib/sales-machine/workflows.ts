import { getEnv } from "@/lib/env";
import { sumOpenAiRunSpend } from "@/lib/billing/openai-app";
import {
  describeResearchProvider,
  enrichLeadWithFallback,
  getAvailableResearchProviders,
} from "@/lib/sales-machine/contact-research";
import { discoverLeadsWithGooglePlaces } from "@/lib/sales-machine/google-places";
import { mutateDb } from "@/lib/sales-machine/store";
import type {
  AiResearchProvider,
  ContactEnrichmentInput,
  ContactEnrichmentResult,
  EnrichmentJob,
  Lead,
  LeadSearchInput,
  SearchLeadResult,
  SearchJob,
  WorkflowRun,
  WorkflowStep,
} from "@/lib/sales-machine/types";
import {
  createId,
  isRateLimitError,
  nowIso,
  serializeError,
} from "@/lib/sales-machine/utils";
import { sendRunCompletedAlert, sendRunFailedAlert } from "@/lib/sales-machine/run-alerts";

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

async function updateRunInput(
  runId: string,
  updater: (input: WorkflowRun["input"]) => WorkflowRun["input"],
) {
  await mutateDb((db) => {
    const run = db.runs.find((candidate) => candidate.id === runId);

    if (!run) {
      throw new Error(`Run ${runId} was not found.`);
    }

    run.input = updater(run.input);
  });
}

async function createSearchJob(runId: string, input: LeadSearchInput) {
  const job: SearchJob = {
    id: createId("searchjob"),
    runId,
    niche: input.niche,
    locationLabel: input.location,
    radiusMeters: input.radiusMeters,
    targetMaxLeads: input.maxLeads,
    status: "running",
    nextPageToken: null,
    pagesFetched: 0,
    leadsCollected: 0,
    warnings: [],
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
  };

  await mutateDb((db) => {
    db.searchJobs.unshift(job);
  });

  return job;
}

async function updateSearchJobProgress(
  jobId: string,
  progress: {
    pageCount: number;
    leadsCollected: number;
    nextPageToken: string | null;
  },
) {
  await mutateDb((db) => {
    const job = db.searchJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Search job ${jobId} was not found.`);
    }

    job.pagesFetched = progress.pageCount;
    job.leadsCollected = progress.leadsCollected;
    job.nextPageToken = progress.nextPageToken;
    job.updatedAt = nowIso();
  });
}

async function finishSearchJob(jobId: string, warnings: string[]) {
  await mutateDb((db) => {
    const job = db.searchJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Search job ${jobId} was not found.`);
    }

    job.status = "completed";
    job.warnings = warnings;
    job.error = null;
    job.nextPageToken = null;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

async function failSearchJob(jobId: string, errorMessage: string) {
  await mutateDb((db) => {
    const job = db.searchJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      return;
    }

    job.status = "failed";
    job.error = errorMessage;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

async function createEnrichmentJob(
  runId: string,
  input: ContactEnrichmentInput,
  providerOrder: AiResearchProvider[],
) {
  const job: EnrichmentJob = {
    id: createId("enrichjob"),
    runId,
    batchSize: input.batchSize,
    providerOrder,
    status: "running",
    leadsClaimed: 0,
    leadsProcessed: 0,
    enrichedCount: 0,
    missingCount: 0,
    failedCount: 0,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
  };

  await mutateDb((db) => {
    db.enrichmentJobs.unshift(job);
  });

  return job;
}

async function updateEnrichmentJob(
  jobId: string,
  update: Partial<
    Pick<
      EnrichmentJob,
      | "leadsClaimed"
      | "leadsProcessed"
      | "enrichedCount"
      | "missingCount"
      | "failedCount"
      | "providerOrder"
    >
  >,
) {
  await mutateDb((db) => {
    const job = db.enrichmentJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Enrichment job ${jobId} was not found.`);
    }

    if (typeof update.leadsClaimed === "number") {
      job.leadsClaimed = update.leadsClaimed;
    }

    if (typeof update.leadsProcessed === "number") {
      job.leadsProcessed = update.leadsProcessed;
    }

    if (typeof update.enrichedCount === "number") {
      job.enrichedCount = update.enrichedCount;
    }

    if (typeof update.missingCount === "number") {
      job.missingCount = update.missingCount;
    }

    if (typeof update.failedCount === "number") {
      job.failedCount = update.failedCount;
    }

    if (update.providerOrder) {
      job.providerOrder = update.providerOrder;
    }

    job.updatedAt = nowIso();
  });
}

async function finishEnrichmentJob(jobId: string) {
  await mutateDb((db) => {
    const job = db.enrichmentJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error(`Enrichment job ${jobId} was not found.`);
    }

    job.status = "completed";
    job.error = null;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

async function failEnrichmentJob(jobId: string, errorMessage: string) {
  await mutateDb((db) => {
    const job = db.enrichmentJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      return;
    }

    job.status = "failed";
    job.error = errorMessage;
    job.updatedAt = nowIso();
    job.finishedAt = nowIso();
  });
}

export async function runLeadSearch(input: LeadSearchInput): Promise<SearchLeadResult> {
  const env = getEnv();
  const run = await createRun("lead-search", input);
  let searchJobId: string | null = null;

  try {
    const providerStep = await addStep(
      run.id,
      "Validate providers",
      "Checking Google Places credentials before searching live.",
    );

    if (!env.googleMapsApiKey) {
      throw new Error(
        "GOOGLE_MAPS_API_KEY is missing. Add it to your environment before running lead discovery.",
      );
    }

    await completeStep(
      run.id,
      providerStep.id,
      "Google Places is ready.",
      input.searchMode === "exhaustive"
        ? "The workflow will keep paging until Google runs out or the safety cap is reached."
        : "The workflow can now geocode the location and page through search results.",
    );

    const searchStep = await addStep(
      run.id,
      "Search Google Places",
      `Searching for ${input.niche} in ${input.location}.`,
    );

    const searchJob = await createSearchJob(run.id, input);
    searchJobId = searchJob.id;

    const searchResult = await discoverLeadsWithGooglePlaces(env.googleMapsApiKey, input, {
      onPageProgress: async (progress) => {
        await updateSearchJobProgress(searchJob.id, progress);
      },
    });

    await completeStep(
      run.id,
      searchStep.id,
      `Found ${searchResult.leads.length} candidate leads across ${searchResult.pageCount} page(s).`,
      searchResult.warnings.join("\n") || undefined,
    );

    await finishSearchJob(searchJob.id, searchResult.warnings);

    const persistStep = await addStep(
      run.id,
      "Upsert leads",
      "Saving leads into the local sales machine store.",
    );

    const persistResult = await mutateDb((db) => {
      let inserted = 0;
      let updated = 0;

      for (const leadSeed of searchResult.leads) {
        const now = nowIso();
        const existing = db.leads.find((lead) => lead.id === leadSeed.id);

        if (existing) {
          existing.companyName = leadSeed.companyName;
          existing.address = leadSeed.address;
          existing.websiteUri = leadSeed.websiteUri;
          existing.rating = leadSeed.rating;
          existing.nationalPhoneNumber = leadSeed.nationalPhoneNumber;
          existing.internationalPhoneNumber = leadSeed.internationalPhoneNumber;
          existing.latitude = leadSeed.latitude;
          existing.longitude = leadSeed.longitude;
          existing.niche = input.niche;
          existing.locationLabel = input.location;
          existing.searchRunId = run.id;
          existing.updatedAt = now;
          updated += 1;
          continue;
        }

        const lead: Lead = {
          id: leadSeed.id,
          companyName: leadSeed.companyName,
          address: leadSeed.address,
          websiteUri: leadSeed.websiteUri,
          rating: leadSeed.rating,
          nationalPhoneNumber: leadSeed.nationalPhoneNumber,
          internationalPhoneNumber: leadSeed.internationalPhoneNumber,
          latitude: leadSeed.latitude,
          longitude: leadSeed.longitude,
          niche: input.niche,
          locationLabel: input.location,
          source: "google-places",
          stage: "discovered",
          personSearched: false,
          contactCount: 0,
          researchSummary: null,
          lastError: null,
          searchRunId: run.id,
          discoveredAt: now,
          updatedAt: now,
        };

        db.leads.push(lead);
        inserted += 1;
      }

      return {
        inserted,
        updated,
      };
    });

    await completeStep(
      run.id,
      persistStep.id,
      `Saved ${persistResult.inserted} new lead(s) and refreshed ${persistResult.updated} existing lead(s).`,
    );

    await finishRun(
      run.id,
      `Lead search completed with ${persistResult.inserted} new leads and ${persistResult.updated} updates.`,
    );

    return {
      runId: run.id,
      inserted: persistResult.inserted,
      updated: persistResult.updated,
      totalFound: searchResult.leads.length,
    };
  } catch (error) {
    if (searchJobId) {
      await failSearchJob(searchJobId, serializeError(error));
    }

    await failRun(run.id, serializeError(error));
    throw error;
  }
}

export async function runContactEnrichment(
  input: ContactEnrichmentInput,
): Promise<ContactEnrichmentResult> {
  const env = getEnv();
  const run = await createRun("contact-enrichment", input);
  let enrichmentJobId: string | null = null;

  try {
    const providerStep = await addStep(
      run.id,
      "Validate providers",
      "Checking AI research providers before research begins.",
    );

    const providerOrder: AiResearchProvider[] = env.geminiApiKey
      ? input.allowOpenAiSecondPass && env.openAiApiKey
        ? ["gemini:google_search", "openai:web_search"]
        : ["gemini:google_search"]
      : env.openAiApiKey
        ? ["openai:web_search"]
        : [];

    if (env.anthropicApiKey) {
      providerOrder.push("claude:web_search");
    }

    const researchProviders = getAvailableResearchProviders({
      ...env,
      openAiApiKey: providerOrder.includes("openai:web_search") ? env.openAiApiKey : null,
      geminiApiKey: providerOrder.includes("gemini:google_search") ? env.geminiApiKey : null,
      anthropicApiKey: providerOrder.includes("claude:web_search") ? env.anthropicApiKey : null,
    });

    if (researchProviders.length === 0) {
      throw new Error(
        "No AI research provider is configured. Add OPENAI_API_KEY or GEMINI_API_KEY before running enrichment.",
      );
    }

    await completeStep(
      run.id,
      providerStep.id,
      "AI research providers are ready.",
      [
        `Provider order: ${researchProviders.map((provider) => provider.label).join(" -> ")}.`,
        input.allowOpenAiSecondPass && env.geminiApiKey && env.openAiApiKey
          ? "OpenAI will only run as a second pass for leads Gemini could not enrich cleanly."
          : env.geminiApiKey
            ? "Gemini will run alone unless you explicitly allow the OpenAI second pass."
            : "OpenAI will run directly because Gemini is not configured.",
      ].join("\n"),
    );

    const queueStep = await addStep(
      run.id,
      "Build enrichment queue",
      input.scope === "run" && input.sourceRunId
        ? "Selecting leads from one lead-search run that still need owner/contact research."
        : "Selecting pending leads across the workspace.",
    );

    const enrichmentJob = await createEnrichmentJob(
      run.id,
      input,
      providerOrder,
    );
    enrichmentJobId = enrichmentJob.id;

    const queuedLeads = await mutateDb((db) =>
      db.leads
        .filter((lead) => {
          if (input.scope === "run" && input.sourceRunId && lead.searchRunId !== input.sourceRunId) {
            return false;
          }

          if (!lead.personSearched) {
            return true;
          }

          return input.includePreviouslyFailed && lead.stage === "error";
        })
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, input.batchSize),
    );

    await completeStep(
      run.id,
      queueStep.id,
      queuedLeads.length
        ? `Queued ${queuedLeads.length} lead(s) for enrichment.`
        : input.scope === "run"
          ? "No pending leads matched the selected search run."
          : "Nothing matched the enrichment queue.",
    );

    await updateEnrichmentJob(enrichmentJob.id, {
      leadsClaimed: queuedLeads.length,
    });

    if (queuedLeads.length === 0) {
      await finishEnrichmentJob(enrichmentJob.id);
      await finishRun(run.id, "No pending leads were available for enrichment.");
      return {
        runId: run.id,
        processed: 0,
        enriched: 0,
        missing: 0,
        failed: 0,
      };
    }

    let processed = 0;
    let enriched = 0;
    let missing = 0;
    let failed = 0;
    const runSpendItems: NonNullable<WorkflowRun["input"]["openAiSpend"]>[] = [];
    const runClaudeSpendItems: NonNullable<WorkflowRun["input"]["claudeSpend"]>[] = [];

    for (const lead of queuedLeads) {
      const leadStep = await addStep(
        run.id,
        `Research ${lead.companyName}`,
        "Looking for owners, founders, directors, and public contact details.",
      );

      try {
        const enrichment = await enrichLeadWithFallback({
          lead,
          env,
          providerOrder,
        });
        const nonClaudeSpend = sumOpenAiRunSpend(
          enrichment.attempts
            .filter((a) => a.provider !== "claude:web_search")
            .map((a) => a.billing)
            .filter(Boolean) as NonNullable<(typeof enrichment.attempts)[number]["billing"]>[],
        );
        const claudeLeadSpend = sumOpenAiRunSpend(
          enrichment.attempts
            .filter((a) => a.provider === "claude:web_search")
            .map((a) => a.billing)
            .filter(Boolean) as NonNullable<(typeof enrichment.attempts)[number]["billing"]>[],
        );
        const leadSpend = nonClaudeSpend;

        await mutateDb((db) => {
          const currentLead = db.leads.find((candidate) => candidate.id === lead.id);

          if (!currentLead) {
            throw new Error(`Lead ${lead.id} disappeared during enrichment.`);
          }

          db.contacts = db.contacts.filter((contact) => contact.leadId !== lead.id);

          for (const person of enrichment.people) {
            db.contacts.push({
              id: createId("contact"),
              leadId: lead.id,
              name: person.name,
              title: person.title,
              email: person.email,
              linkedin: person.linkedin,
              instagram: person.instagram,
              twitter: person.twitter,
              facebook: person.facebook,
              confidence: person.confidence,
              source: "openai-web-search",
              discoveredAt: nowIso(),
            });
          }

          currentLead.personSearched = true;
          currentLead.stage = enrichment.people.length > 0 ? "enriched" : "contact_missing";
          currentLead.contactCount = enrichment.people.length;
          currentLead.researchSummary = enrichment.summary;
          currentLead.lastError = null;
          currentLead.updatedAt = nowIso();
        });

        if (leadSpend) {
          runSpendItems.push(leadSpend);
        }

        if (claudeLeadSpend) {
          runClaudeSpendItems.push(claudeLeadSpend);
        }

        if (leadSpend || claudeLeadSpend) {
          await updateRunInput(run.id, (currentInput) => ({
            ...currentInput,
            openAiSpend: sumOpenAiRunSpend(runSpendItems),
            claudeSpend: sumOpenAiRunSpend(runClaudeSpendItems),
          }));
        }

        processed += 1;

        if (enrichment.people.length > 0) {
          enriched += 1;
        } else {
          missing += 1;
        }

        await updateEnrichmentJob(enrichmentJob.id, {
          leadsProcessed: processed,
          enrichedCount: enriched,
          missingCount: missing,
          failedCount: failed,
        });

        await completeStep(
          run.id,
          leadStep.id,
          enrichment.people.length > 0
            ? `Saved ${enrichment.people.length} contact(s) with ${describeResearchProvider(enrichment.provider)}.`
            : `Research completed with ${describeResearchProvider(enrichment.provider)}, but no clear contacts were found.`,
          [
            `Provider used: ${describeResearchProvider(enrichment.provider)}`,
            ...enrichment.attempts.map((attempt) => {
              const count =
                typeof attempt.peopleFound === "number"
                  ? ` People found: ${attempt.peopleFound}.`
                  : "";
              const errorText = attempt.error ? ` Error: ${attempt.error}` : "";
              const costText =
                typeof attempt.estimatedCostUsd === "number"
                  ? ` Estimated cost: $${attempt.estimatedCostUsd.toFixed(4)}.`
                  : "";

              return `${attempt.label}: ${attempt.reason}${count}${costText}${errorText}`;
            }),
            "",
            enrichment.summary,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch (error) {
        processed += 1;
        failed += 1;

        await mutateDb((db) => {
          const currentLead = db.leads.find((candidate) => candidate.id === lead.id);

          if (!currentLead) {
            return;
          }

          currentLead.stage = "error";
          currentLead.lastError = serializeError(error);
          currentLead.updatedAt = nowIso();
        });

        await updateEnrichmentJob(enrichmentJob.id, {
          leadsProcessed: processed,
          enrichedCount: enriched,
          missingCount: missing,
          failedCount: failed,
        });

        await failStep(
          run.id,
          leadStep.id,
          `Research failed for ${lead.companyName}.`,
          serializeError(error),
        );

        if (isRateLimitError(error)) {
          throw new Error(
            "An AI provider hit a rate limit or quota while enriching leads. The run stopped so you can rotate or refill credentials.",
          );
        }
      }
    }

    await finishEnrichmentJob(enrichmentJob.id);
    const totalOpenAiSpend = sumOpenAiRunSpend(runSpendItems);

    if (totalOpenAiSpend) {
      await updateRunInput(run.id, (currentInput) => ({
        ...currentInput,
        openAiSpend: totalOpenAiSpend,
      }));
    }

    await finishRun(
      run.id,
      `Enrichment finished: ${enriched} enriched, ${missing} missing, ${failed} failed.${totalOpenAiSpend ? ` Estimated OpenAI cost: $${totalOpenAiSpend.estimatedCostUsd.toFixed(4)}.` : ""}`,
    );

    return {
      runId: run.id,
      processed,
      enriched,
      missing,
      failed,
    };
  } catch (error) {
    if (enrichmentJobId) {
      await failEnrichmentJob(enrichmentJobId, serializeError(error));
    }

    await failRun(run.id, serializeError(error));
    throw error;
  }
}
