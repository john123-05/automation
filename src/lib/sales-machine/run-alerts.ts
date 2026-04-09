import { sendTelegramSystemAlert } from "@/lib/telegram";
import type { WorkflowRun } from "@/lib/sales-machine/types";

function formatRunKind(kind: WorkflowRun["kind"]) {
  switch (kind) {
    case "lead-search":
      return "Lead Search";
    case "contact-enrichment":
      return "Enrich Contacts";
    case "website-audit":
      return "Website Audit";
    case "sequence-generation":
      return "Sequence Generation";
    case "message-send":
      return "Message Send";
    case "inbox-sync":
      return "Inbox Sync";
    default:
      return kind;
  }
}

function formatDuration(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) {
    return null;
  }

  const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function shouldSuppressRunAlert(run: WorkflowRun) {
  return Boolean((run.input as Record<string, unknown> | undefined)?.telegramSource);
}

export async function sendRunCompletedAlert(run: WorkflowRun, summary: string) {
  if (shouldSuppressRunAlert(run)) {
    return;
  }

  try {
    await sendTelegramSystemAlert({
      title: "Workflow completed",
      lines: [
        `Run: ${formatRunKind(run.kind)}`,
        `Summary: ${summary}`,
        ...(formatDuration(run.startedAt, run.finishedAt) ? [`Duration: ${formatDuration(run.startedAt, run.finishedAt)}`] : []),
      ],
    });
  } catch (error) {
    console.error("Failed to send workflow completion alert.", error);
  }
}

export async function sendRunFailedAlert(run: WorkflowRun, errorMessage: string) {
  if (shouldSuppressRunAlert(run)) {
    return;
  }

  try {
    await sendTelegramSystemAlert({
      title: "Workflow failed",
      lines: [
        `Run: ${formatRunKind(run.kind)}`,
        `Error: ${errorMessage}`,
        ...(formatDuration(run.startedAt, run.finishedAt) ? [`Duration: ${formatDuration(run.startedAt, run.finishedAt)}`] : []),
      ],
    });
  } catch (error) {
    console.error("Failed to send workflow failure alert.", error);
  }
}
