import { OutreachShell } from "@/components/outreach-shell";
import { TemplateServiceSwitcher } from "@/components/template-service-switcher";
import { getOutreachSnapshot } from "@/lib/sales-machine/store";
import { formatServiceLabel, getOutreachShellStats } from "@/lib/sales-machine/outreach-ui";

export const dynamic = "force-dynamic";

type OutreachTemplatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function OutreachTemplatesPage({
  searchParams,
}: OutreachTemplatesPageProps) {
  const snapshot = await getOutreachSnapshot();
  const query = (searchParams ? await searchParams : undefined) ?? {};
  const requestedServiceKey = readSearchParam(query.service);
  const selectedProfile =
    snapshot.serviceProfiles.find((profile) => profile.serviceKey === requestedServiceKey) ??
    snapshot.serviceProfiles[0] ??
    null;
  const selectedTemplates = selectedProfile
    ? snapshot.sequenceTemplates
        .filter((template) => template.serviceKey === selectedProfile.serviceKey)
        .sort((a, b) => a.stepNumber - b.stepNumber)
    : [];

  return (
    <OutreachShell activeNav="templates" title="Templates" stats={getOutreachShellStats(snapshot)}>
      <section className="glass-panel rounded-[34px] p-6">
        <TemplateServiceSwitcher
          initialServiceKey={selectedProfile?.serviceKey ?? null}
          serviceProfiles={snapshot.serviceProfiles.map((profile) => ({
            id: profile.id,
            serviceKey: profile.serviceKey,
            label: formatServiceLabel(profile.serviceKey),
            shortDescription: profile.shortDescription,
          }))}
          templates={selectedTemplates.length > 0 || snapshot.sequenceTemplates.length > 0
            ? snapshot.sequenceTemplates.map((template) => ({
                id: template.id,
                serviceKey: template.serviceKey,
                stepNumber: template.stepNumber,
                dayOffset: template.dayOffset,
                subjectTemplate: template.subjectTemplate,
                bodyTemplate: template.bodyTemplate,
              }))
            : []}
        />
      </section>
    </OutreachShell>
  );
}
