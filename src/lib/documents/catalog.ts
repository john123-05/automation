const documentFileNames = [
  "01 - GET YOUR FRIST CLIENT OVERVIEW.pdf",
  "02 - WARM OUTREACH (1).pdf",
  "02 - WARM OUTREACH.pdf",
  "03 - LOCAL OUTREACH.pdf",
  "04 - MASTER THE SALES CALL.pdf",
  "05 - CLIENT AIKIDO + NEXT STEPS.pdf",
  "Accessing a Client’s Meta Business Manager.pdf",
  "Accessing a Clients Google Ads Account.pdf",
  "Arno's Lead Magnet.pdf",
  "BM Challenge Official Document.pdf",
  "Client Proposal.pdf",
  "FORCE SUCCESS.pdf",
  "HOW TO GET YOUR EMAIL DELIVERED IN 2024.pdf",
  "How to Land any Sales job.pdf",
  "How To Onboard Clients.pdf",
  "How To Set Up A Google Ads Account That Works And Converts.pdf",
  "How To Write An Article.pdf",
  "Job Proposal Template.pdf",
  "Kopie von SM+CA 2.0 AI Prompts.pdf",
  "Letter Of Agreement.pdf",
  "Meta Ads Policy Aikido.pdf",
  "Meta Business Suite.pdf",
  "New Local SEO Clients For ProfResults.pdf",
  "RR - Example Sales Call Transcript.pdf",
  "RR - Sales Call Preparation Checklist.pdf",
  "Setting Up a Meta Pixel.pdf",
  "Spy on Prospect and Competitor Meta Ads.pdf",
  "Vectorize Your Logo For Free.pdf",
  "Website Design Checklist.pdf",
  "WordPress - Zapier.pdf",
] as const;

function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export type DocumentCatalogEntry = {
  slug: string;
  title: string;
  fileName: string;
  storagePath: string;
};

function buildCatalog() {
  const counts = new Map<string, number>();

  return documentFileNames.map((fileName) => {
    const title = fileName.replace(/\.pdf$/i, "");
    const baseSlug = createSlug(title);
    const nextCount = (counts.get(baseSlug) ?? 0) + 1;

    counts.set(baseSlug, nextCount);

    return {
      slug: nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`,
      title,
      fileName,
      storagePath: fileName,
    } satisfies DocumentCatalogEntry;
  });
}

export const documentsCatalog = buildCatalog();
