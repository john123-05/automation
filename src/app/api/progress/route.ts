import { NextResponse } from "next/server";
import { readDb } from "@/lib/sales-machine/store";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const STALE_JOB_MS = 10 * 60 * 1000; // 10 minutes — longer than maxDuration

function latestRunningJob<T extends { status: string; updatedAt: string }>(jobs: T[]) {
  return jobs
    .filter((job) => {
      if (job.status !== "running") return false;
      // Treat jobs not updated for > 10 min as stale (Vercel function timed out)
      return Date.now() - new Date(job.updatedAt).getTime() < STALE_JOB_MS;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export async function GET() {
  try {
    const db = await readDb();
    const searchJob = latestRunningJob(db.searchJobs);
    const enrichmentJob = latestRunningJob(db.enrichmentJobs);
    const searchRun = searchJob ? db.runs.find((run) => run.id === searchJob.runId) ?? null : null;
    const enrichmentRun = enrichmentJob
      ? db.runs.find((run) => run.id === enrichmentJob.runId) ?? null
      : null;
    const searchMode =
      searchRun?.kind === "lead-search" && searchRun.input.searchMode === "exhaustive"
        ? "exhaustive"
        : "capped";

    return NextResponse.json({
      search:
        searchJob && searchRun
          ? {
              runId: searchRun.id,
              current: searchJob.leadsCollected,
              total: searchJob.targetMaxLeads,
              pagesFetched: searchJob.pagesFetched,
              percent:
                searchJob.targetMaxLeads > 0
                  ? Math.min(100, Math.round((searchJob.leadsCollected / searchJob.targetMaxLeads) * 100))
                  : 0,
              detail:
                searchMode === "exhaustive"
                  ? `${searchJob.leadsCollected} leads across ${searchJob.pagesFetched} page(s). Running until Google stops or the safety cap is hit.`
                  : `${searchJob.leadsCollected} / ${searchJob.targetMaxLeads} leads saved across ${searchJob.pagesFetched} page(s).`,
            }
          : null,
      enrichment:
        enrichmentJob && enrichmentRun
          ? {
              runId: enrichmentRun.id,
              current: enrichmentJob.leadsProcessed,
              total: enrichmentJob.leadsClaimed,
              enriched: enrichmentJob.enrichedCount,
              missing: enrichmentJob.missingCount,
              failed: enrichmentJob.failedCount,
              percent:
                enrichmentJob.leadsClaimed > 0
                  ? Math.min(100, Math.round((enrichmentJob.leadsProcessed / enrichmentJob.leadsClaimed) * 100))
                  : 0,
              detail: `${enrichmentJob.leadsProcessed} / ${enrichmentJob.leadsClaimed} leads processed. ${enrichmentJob.enrichedCount} enriched, ${enrichmentJob.missingCount} no-match, ${enrichmentJob.failedCount} failed.`,
            }
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
