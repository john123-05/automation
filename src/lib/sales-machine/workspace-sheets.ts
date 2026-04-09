import type { Contact, Lead, WorkflowRun } from "@/lib/sales-machine/types";

export type WorkspaceSheet = {
  key: string;
  niche: string;
  location: string;
  label: string;
  leadCount: number;
  contactCount: number;
  latestTouchedAt: string;
  searchRunIds: string[];
};

function humanizeValue(value: string) {
  return value
    .trim()
    .split(/(\s+|,|-)/)
    .map((token) => {
      if (!token.trim() || token === "," || token === "-") {
        return token;
      }

      if (token === token.toUpperCase() && token.length <= 4) {
        return token;
      }

      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join("");
}

export function createSheetKey(niche: string, location: string) {
  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return `${toSlug(niche)}__${toSlug(location)}`;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getSheetKeyFromRun(run: WorkflowRun) {
  const niche = isNonEmptyString(run.input.niche) ? run.input.niche.trim() : null;
  const location = isNonEmptyString(run.input.location) ? run.input.location.trim() : null;

  if (!niche || !location) {
    return null;
  }

  return createSheetKey(niche, location);
}

export function getDefaultSheetLabel(niche: string, location: string) {
  return `${humanizeValue(niche)} • ${humanizeValue(location)}`;
}

export function getCustomSheetLabelFromRun(run: WorkflowRun) {
  return isNonEmptyString(run.input.sheetLabel) ? run.input.sheetLabel.trim() : null;
}

export function buildWorkspaceSheets(snapshot: {
  leads: Lead[];
  contacts: Contact[];
  runs: WorkflowRun[];
}) {
  const leadsById = new Map(snapshot.leads.map((lead) => [lead.id, lead]));
  const customSheetLabels = new Map<string, { label: string; startedAt: string }>();

  for (const run of snapshot.runs) {
    if (run.kind !== "lead-search") {
      continue;
    }

    const key = getSheetKeyFromRun(run);
    const customLabel = getCustomSheetLabelFromRun(run);

    if (!key || !customLabel) {
      continue;
    }

    const existing = customSheetLabels.get(key);

    if (!existing || run.startedAt > existing.startedAt) {
      customSheetLabels.set(key, {
        label: customLabel,
        startedAt: run.startedAt,
      });
    }
  }

  const sheetMap = new Map<
    string,
    {
      key: string;
      niche: string;
      location: string;
      label: string;
      leadCount: number;
      contactCount: number;
      latestTouchedAt: string;
      searchRunIds: Set<string>;
    }
  >();

  const ensureSheet = (niche: string, location: string) => {
    const key = createSheetKey(niche, location);
    const existing = sheetMap.get(key);

    if (existing) {
      return existing;
    }

    const created = {
      key,
      niche,
      location,
      label: customSheetLabels.get(key)?.label ?? getDefaultSheetLabel(niche, location),
      leadCount: 0,
      contactCount: 0,
      latestTouchedAt: "",
      searchRunIds: new Set<string>(),
    };

    sheetMap.set(key, created);
    return created;
  };

  for (const lead of snapshot.leads) {
    const sheet = ensureSheet(lead.niche, lead.locationLabel);
    sheet.leadCount += 1;
    sheet.latestTouchedAt =
      !sheet.latestTouchedAt || lead.updatedAt > sheet.latestTouchedAt
        ? lead.updatedAt
        : sheet.latestTouchedAt;
  }

  for (const contact of snapshot.contacts) {
    const lead = leadsById.get(contact.leadId);

    if (!lead) {
      continue;
    }

    const sheet = ensureSheet(lead.niche, lead.locationLabel);
    sheet.contactCount += 1;
    sheet.latestTouchedAt =
      !sheet.latestTouchedAt || contact.discoveredAt > sheet.latestTouchedAt
        ? contact.discoveredAt
        : sheet.latestTouchedAt;
  }

  for (const run of snapshot.runs) {
    if (run.kind !== "lead-search") {
      continue;
    }

    const niche = isNonEmptyString(run.input.niche) ? run.input.niche.trim() : null;
    const location = isNonEmptyString(run.input.location) ? run.input.location.trim() : null;

    if (!niche || !location) {
      continue;
    }

    const sheet = ensureSheet(niche, location);
    sheet.searchRunIds.add(run.id);
    sheet.latestTouchedAt =
      !sheet.latestTouchedAt || run.startedAt > sheet.latestTouchedAt
        ? run.startedAt
        : sheet.latestTouchedAt;
  }

  return [...sheetMap.values()]
    .sort((a, b) => b.latestTouchedAt.localeCompare(a.latestTouchedAt))
    .map((sheet) => ({
      key: sheet.key,
      niche: sheet.niche,
      location: sheet.location,
      label: sheet.label,
      leadCount: sheet.leadCount,
      contactCount: sheet.contactCount,
      latestTouchedAt: sheet.latestTouchedAt,
      searchRunIds: [...sheet.searchRunIds],
    })) satisfies WorkspaceSheet[];
}
