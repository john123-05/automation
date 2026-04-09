import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/app-auth";

type CampaignRootPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CampaignRootPage({ params }: CampaignRootPageProps) {
  const { id } = await params;
  await requireAppAccess(`/outreach/campaign/${id}`);
  redirect(`/outreach/campaign/${id}/overview`);
}
