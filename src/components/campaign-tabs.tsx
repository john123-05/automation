import Link from "next/link";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "sequences", label: "Sequences" },
  { id: "schedule", label: "Schedule" },
  { id: "options", label: "Options" },
] as const;

export function CampaignTabs({
  campaignId,
  active,
}: {
  campaignId: string;
  active: (typeof tabs)[number]["id"];
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-line pb-4">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/outreach/campaign/${campaignId}/${tab.id}`}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab.id === active
              ? "bg-slate-950 text-white"
              : "border border-line bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
