import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/env";
import { getDashboardSnapshot } from "@/lib/sales-machine/store";
import {
  buildWorkspaceSheets,
  createSheetKey,
  getDefaultSheetLabel,
} from "@/lib/sales-machine/workspace-sheets";

export const runtime = "nodejs";

function csvEscape(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function csvFilename(label: string, type: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "workspace"}-${type}.csv`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sheetKey = url.searchParams.get("sheet");
  const type = url.searchParams.get("type") === "contacts" ? "contacts" : "leads";
  const snapshot = await getDashboardSnapshot(getProviderStatuses());
  const sheets = buildWorkspaceSheets(snapshot);
  const activeSheet = sheetKey ? sheets.find((sheet) => sheet.key === sheetKey) ?? null : null;

  const leads = activeSheet
    ? snapshot.leads.filter(
        (lead) =>
          createSheetKey(lead.niche, lead.locationLabel) === activeSheet.key,
      )
    : snapshot.leads;
  const leadIds = new Set(leads.map((lead) => lead.id));
  const contacts = snapshot.contacts.filter((contact) => leadIds.has(contact.leadId));

  const filename = csvFilename(
    activeSheet?.label ?? getDefaultSheetLabel("all workspace", "export"),
    type,
  );

  if (type === "contacts") {
    const rows = [
      [
        "lead_company",
        "niche",
        "location",
        "name",
        "title",
        "email",
        "linkedin",
        "instagram",
        "twitter",
        "facebook",
        "confidence",
        "found_at",
      ],
      ...contacts.map((contact) => {
        const lead = leads.find((item) => item.id === contact.leadId);

        return [
          lead?.companyName ?? contact.leadId,
          lead?.niche ?? "",
          lead?.locationLabel ?? "",
          contact.name,
          contact.title ?? "",
          contact.email ?? "",
          contact.linkedin ?? "",
          contact.instagram ?? "",
          contact.twitter ?? "",
          contact.facebook ?? "",
          contact.confidence,
          contact.discoveredAt,
        ];
      }),
    ];

    const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const rows = [
    [
      "company_name",
      "status",
      "niche",
      "location",
      "address",
      "website",
      "phone",
      "rating",
      "contact_count",
      "updated_at",
    ],
    ...leads.map((lead) => [
      lead.companyName,
      lead.stage,
      lead.niche,
      lead.locationLabel,
      lead.address,
      lead.websiteUri ?? "",
      lead.internationalPhoneNumber ?? lead.nationalPhoneNumber ?? "",
      lead.rating ?? "",
      lead.contactCount,
      lead.updatedAt,
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
