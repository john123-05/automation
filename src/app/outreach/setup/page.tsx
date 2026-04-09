import { CampaignCreateForm } from "@/components/campaign-create-form";
import { OutreachAuditForm } from "@/components/outreach-audit-form";
import { OutreachSequenceForm } from "@/components/outreach-sequence-form";
import { OutreachShell } from "@/components/outreach-shell";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { getOutreachShellStats } from "@/lib/sales-machine/outreach-ui";
import { formatDateTime } from "@/lib/sales-machine/utils";

export const dynamic = "force-dynamic";

function getLeadRunLabel(run: Awaited<ReturnType<typeof getOutreachSnapshot>>["runs"][number]) {
  const niche = typeof run.input.niche === "string" ? run.input.niche : "Lead search";
  const location =
    typeof run.input.location === "string"
      ? run.input.location
      : typeof run.input.locationLabel === "string"
        ? run.input.locationLabel
        : formatDateTime(run.startedAt);

  return `${niche} · ${location}`;
}

export default async function OutreachSetupPage() {
  const snapshot = await getOutreachSnapshot();
  const runOptions = snapshot.runs
    .filter((run) => run.kind === "lead-search")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((run) => ({
      id: run.id,
      label: getLeadRunLabel(run),
    }));
  const sheetOptions = snapshot.sheets.map((sheet) => ({
    id: sheet.key,
    label: sheet.label,
  }));
  const mailboxOptions = snapshot.connectedMailboxes
    .filter((mailbox) => mailbox.status === "connected")
    .map((mailbox) => ({
      id: mailbox.id,
      label: mailbox.displayName ? `${mailbox.displayName} · ${mailbox.email}` : mailbox.email,
    }));
  const recentRuns = snapshot.runs
    .filter((run) =>
      ["website-audit", "sequence-generation", "inbox-sync", "message-send"].includes(run.kind),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 8);

  return (
    <OutreachShell activeNav="setup" title="Setup" stats={getOutreachShellStats(snapshot)}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="glass-panel rounded-[34px] p-6">
          <div className="border-b border-line pb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Campaign builder</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Create the campaign first, then run the workflow
            </h2>
          </div>

          <div className="mt-6">
            <CampaignCreateForm
              runOptions={runOptions}
              sheetOptions={sheetOptions}
              mailboxOptions={mailboxOptions}
            />
          </div>
        </section>

        <section className="glass-panel rounded-[34px] p-6">
          <div className="border-b border-line pb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Operator notes</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Keep the engine manual-first until the copy feels right
            </h2>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              Use campaigns as the top-level container. Each campaign holds one service lens, one
              source scope, one mailbox, and one cadence.
            </p>
            <p>
              If you already have audited leads, you can still run ad-hoc audit and sequence jobs
              below to backfill older work.
            </p>
            <div className="rounded-[24px] border border-line bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Connected mailboxes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{mailboxOptions.length}</p>
              <p className="mt-2 text-sm text-slate-600">
                Assign one connected Gmail inbox per campaign before activation.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass-panel rounded-[34px] p-6">
          <div className="border-b border-line pb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Audit & variables</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Run the website lens and store proof points
            </h2>
          </div>

          <div className="mt-6">
            <OutreachAuditForm runOptions={runOptions} sheetOptions={sheetOptions} />
          </div>
        </section>

        <section className="glass-panel rounded-[34px] p-6">
          <div className="border-b border-line pb-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Sequence generation</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Turn saved findings into the 4-step written cadence
            </h2>
          </div>

          <div className="mt-6">
            <OutreachSequenceForm
              runOptions={runOptions}
              sheetOptions={sheetOptions}
              mailboxOptions={mailboxOptions}
            />
          </div>
        </section>
      </div>

      <section className="glass-panel rounded-[34px] p-6">
        <div className="border-b border-line pb-4">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Recent ops</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Latest audit, generation, inbox, and send runs
          </h2>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[28px] border border-line bg-white/84">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[140px_180px_minmax(260px,1fr)_140px] gap-4 border-b border-line px-5 py-4 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <span>Kind</span>
              <span>Started</span>
              <span>Summary</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-line">
              {recentRuns.length ? (
                recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="grid grid-cols-[140px_180px_minmax(260px,1fr)_140px] gap-4 px-5 py-4"
                  >
                    <p className="text-sm font-medium text-slate-900">{run.kind}</p>
                    <p className="text-sm text-slate-600">{formatDateTime(run.startedAt)}</p>
                    <p className="text-sm text-slate-700">{run.summary ?? "No summary captured yet."}</p>
                    <div className="flex items-start">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {run.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-16 text-center text-sm text-slate-600">
                  No outreach operations have been run yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </OutreachShell>
  );
}
