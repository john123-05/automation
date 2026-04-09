import { redirect } from "next/navigation";

type CampaignRootPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CampaignRootPage({ params }: CampaignRootPageProps) {
  const { id } = await params;
  redirect(`/outreach/campaign/${id}/overview`);
}
