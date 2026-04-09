import type {
  AuditIssueType,
  Lead,
  ProspectVariableBag,
  ServiceKey,
} from "@/lib/sales-machine/types";

type WebsiteSignals = {
  websiteUrl: string;
  homepageHtml: string | null;
  homepageStatus: number | null;
  robotsTxt: string | null;
  sitemapXml: string | null;
  sitemapUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1s: string[];
  internalLinkCount: number;
  sitemapUrlCount: number;
  hasForm: boolean;
  hasVisibleCta: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasSocialProof: boolean;
  headlineText: string | null;
  fetchError: string | null;
};

type CandidateFinding = {
  score: number;
  issueType: AuditIssueType;
  pageUrl: string | null;
  pageLabel: string | null;
  summary: string;
  recognizableReason: string;
  consequenceMechanics: string;
  reviewTime: string;
  microYes: string;
  previewAssetExists: boolean;
  evidence: string[];
};

export type AuditOutcome = {
  finding: Omit<CandidateFinding, "score"> & {
    rawSignals: Record<string, unknown>;
  };
  variables: ProspectVariableBag;
};

const CTA_PATTERN =
  /\b(book|schedule|get started|contact us|contact|call now|get a quote|request a quote|free consult|consultation|demo|speak to|talk to|start now|enquire|apply now)\b/i;
const PHONE_PATTERN =
  /(\+\d{1,3}\s?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SOCIAL_PROOF_PATTERN =
  /\b(testimonial|case stud(y|ies)|trusted by|client(s)?|review(s)?|5-star|award-winning|portfolio)\b/i;

function ensureUrl(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function withTimeout(signal: AbortSignal, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  signal.addEventListener("abort", () => {
    controller.abort();
    clearTimeout(timeout);
  });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
    },
  };
}

async function fetchText(url: string, parentSignal?: AbortSignal) {
  const controller = new AbortController();

  if (parentSignal) {
    parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const { signal, cleanup } = withTimeout(controller.signal, 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LeanMeanLeadFinder/1.0; +https://example.com/outreach-audit)",
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      text,
      url: response.url,
    };
  } finally {
    cleanup();
  }
}

function extractTagContent(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = html.match(pattern)?.[1] ?? null;
  return match ? stripHtml(match) : null;
}

function extractAllTagContent(html: string, tagName: string) {
  const matches = [...html.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi"))];
  return matches
    .map((match) => stripHtml(match[1] ?? ""))
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractMetaDescription(html: string) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1]?.trim();

    if (match) {
      return match;
    }
  }

  return null;
}

function extractCanonical(html: string) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1]?.trim();

    if (match) {
      return match;
    }
  }

  return null;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function countInternalLinks(html: string, websiteUrl: string) {
  const base = new URL(websiteUrl);
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)];

  return matches.filter((match) => {
    const href = match[1];

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return false;
    }

    try {
      const resolved = new URL(href, websiteUrl);
      return resolved.host === base.host;
    } catch {
      return false;
    }
  }).length;
}

function countSitemapUrls(xml: string) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].length;
}

function formatIssueLabel(issueType: AuditIssueType) {
  return issueType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function collectSignals(lead: Lead): Promise<WebsiteSignals> {
  const websiteUrl = ensureUrl(lead.websiteUri ?? "");

  try {
    const homepageResponse = await fetchText(websiteUrl);
    const homepageHtml = homepageResponse.ok ? homepageResponse.text : null;

    let sitemapXml: string | null = null;
    let sitemapUrl: string | null = null;
    let robotsTxt: string | null = null;

    const robotsUrl = new URL("/robots.txt", websiteUrl).toString();

    try {
      const robotsResponse = await fetchText(robotsUrl);
      robotsTxt = robotsResponse.ok ? robotsResponse.text : null;
      sitemapUrl =
        robotsTxt
          ?.split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.toLowerCase().startsWith("sitemap:"))
          ?.split(":")
          .slice(1)
          .join(":")
          .trim() ?? null;
    } catch {
      robotsTxt = null;
    }

    const sitemapCandidateUrl =
      sitemapUrl ?? new URL("/sitemap.xml", homepageResponse.url ?? websiteUrl).toString();

    try {
      const sitemapResponse = await fetchText(sitemapCandidateUrl);

      if (sitemapResponse.ok && /<urlset|<sitemapindex/i.test(sitemapResponse.text)) {
        sitemapXml = sitemapResponse.text;
        sitemapUrl = sitemapCandidateUrl;
      }
    } catch {
      sitemapXml = null;
    }

    const visibleText = homepageHtml ? stripHtml(homepageHtml) : "";
    const title = homepageHtml ? extractTagContent(homepageHtml, "title") : null;
    const metaDescription = homepageHtml ? extractMetaDescription(homepageHtml) : null;
    const canonicalUrl = homepageHtml ? extractCanonical(homepageHtml) : null;
    const h1s = homepageHtml ? extractAllTagContent(homepageHtml, "h1") : [];
    const headlineText = h1s[0] ?? title;

    return {
      websiteUrl,
      homepageHtml,
      homepageStatus: homepageResponse.status,
      robotsTxt,
      sitemapXml,
      sitemapUrl,
      title,
      metaDescription,
      canonicalUrl,
      h1s,
      internalLinkCount: homepageHtml ? countInternalLinks(homepageHtml, homepageResponse.url) : 0,
      sitemapUrlCount: sitemapXml ? countSitemapUrls(sitemapXml) : 0,
      hasForm: homepageHtml ? /<form[\s>]/i.test(homepageHtml) : false,
      hasVisibleCta: CTA_PATTERN.test(visibleText),
      hasPhone: PHONE_PATTERN.test(visibleText),
      hasEmail: EMAIL_PATTERN.test(visibleText),
      hasSocialProof: SOCIAL_PROOF_PATTERN.test(visibleText),
      headlineText,
      fetchError: homepageHtml ? null : `Homepage returned status ${homepageResponse.status}.`,
    };
  } catch (error) {
    return {
      websiteUrl,
      homepageHtml: null,
      homepageStatus: null,
      robotsTxt: null,
      sitemapXml: null,
      sitemapUrl: null,
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      h1s: [],
      internalLinkCount: 0,
      sitemapUrlCount: 0,
      hasForm: false,
      hasVisibleCta: false,
      hasPhone: false,
      hasEmail: false,
      hasSocialProof: false,
      headlineText: null,
      fetchError: error instanceof Error ? error.message : "Website fetch failed.",
    };
  }
}

function buildCommonCandidates(signals: WebsiteSignals): CandidateFinding[] {
  const candidates: CandidateFinding[] = [];

  if (signals.fetchError) {
    candidates.push({
      score: 100,
      issueType: "site_unreachable",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the site was not reliably reachable during the check",
      recognizableReason:
        signals.fetchError ?? "the homepage did not return a stable HTML response",
      consequenceMechanics:
        "buyers or search engines can hit a dead end before they even see the offer",
      reviewTime: "a 4-minute review",
      microYes: "Want me to send the short breakdown?",
      previewAssetExists: false,
      evidence: [
        signals.fetchError ?? "Website fetch failed.",
        `Homepage status: ${signals.homepageStatus ?? "no response"}.`,
      ],
    });

    return candidates;
  }

  if (!signals.sitemapXml) {
    candidates.push({
      score: 88,
      issueType: "missing_sitemap",
      pageUrl: signals.sitemapUrl ?? new URL("/sitemap.xml", signals.websiteUrl).toString(),
      pageLabel: "sitemap.xml",
      summary: "the sitemap path does not return a crawlable XML sitemap",
      recognizableReason:
        "checking /sitemap.xml did not produce a usable XML sitemap during the crawl",
      consequenceMechanics:
        "important pages become harder for search engines to discover, refresh, and map cleanly",
      reviewTime: "a 4-minute SEO review",
      microYes: "Want me to send the exact fix path?",
      previewAssetExists: false,
      evidence: [
        `Sitemap URL checked: ${signals.sitemapUrl ?? new URL("/sitemap.xml", signals.websiteUrl).toString()}.`,
        "No usable XML sitemap was returned.",
      ],
    });
  }

  if (!signals.metaDescription) {
    candidates.push({
      score: 78,
      issueType: "missing_meta_description",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the homepage is missing a clear meta description",
      recognizableReason: "the HTML does not expose a meta description tag with usable copy",
      consequenceMechanics:
        "search snippets are left with less guidance, which makes click-through intent weaker",
      reviewTime: "a short SEO review",
      microYes: "Want the quick recommendation?",
      previewAssetExists: false,
      evidence: [
        `Title: ${signals.title ?? "missing"}.`,
        "Meta description: missing.",
      ],
    });
  }

  if (signals.h1s.length === 0) {
    candidates.push({
      score: 76,
      issueType: "missing_h1",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the homepage has no visible H1 headline",
      recognizableReason: "the page structure does not expose a primary H1 heading",
      consequenceMechanics:
        "the core topic is less obvious to both visitors and crawlers on the first pass",
      reviewTime: "a 4-minute review",
      microYes: "Want the exact fix suggestion?",
      previewAssetExists: false,
      evidence: ["H1 count: 0.", `Title: ${signals.title ?? "missing"}.`],
    });
  }

  if (!signals.canonicalUrl) {
    candidates.push({
      score: 68,
      issueType: "missing_canonical",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the homepage does not expose a canonical URL",
      recognizableReason: "the HTML is missing a rel=canonical tag",
      consequenceMechanics:
        "URL ambiguity becomes easier to create, which can dilute how the page is indexed",
      reviewTime: "a short technical review",
      microYes: "Want me to send the exact note?",
      previewAssetExists: false,
      evidence: ["Canonical: missing."],
    });
  }

  if (!signals.hasVisibleCta) {
    candidates.push({
      score: 84,
      issueType: "missing_cta",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "there is no clear next-step CTA on the homepage",
      recognizableReason:
        "the visible homepage copy does not clearly ask visitors to book, contact, call, or request anything",
      consequenceMechanics:
        "people can understand the business and still not know what action to take next",
      reviewTime: "a 4-minute homepage teardown",
      microYes: "Want me to send the CTA fix idea?",
      previewAssetExists: true,
      evidence: [
        `Visible CTA detected: ${signals.hasVisibleCta ? "yes" : "no"}.`,
        `Headline: ${signals.headlineText ?? "missing"}.`,
      ],
    });
  }

  if (!signals.hasForm && !signals.hasPhone && !signals.hasEmail) {
    candidates.push({
      score: 86,
      issueType: "missing_contact_path",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the site does not show an obvious inquiry path",
      recognizableReason:
        "I could not spot a form, public phone number, or visible email on the homepage pass",
      consequenceMechanics:
        "high-intent visitors can hesitate because the handoff into a conversation feels too passive",
      reviewTime: "a short conversion review",
      microYes: "Want me to send the quick fix list?",
      previewAssetExists: true,
      evidence: [
        `Form present: ${signals.hasForm ? "yes" : "no"}.`,
        `Phone visible: ${signals.hasPhone ? "yes" : "no"}.`,
        `Email visible: ${signals.hasEmail ? "yes" : "no"}.`,
      ],
    });
  }

  const weakHeadline =
    !signals.headlineText ||
    signals.headlineText.split(/\s+/).length < 4 ||
    signals.headlineText.length < 20;

  if (weakHeadline) {
    candidates.push({
      score: 82,
      issueType: "weak_headline",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the homepage headline stays generic and unclear",
      recognizableReason:
        signals.headlineText && signals.headlineText.length > 0
          ? `the headline reads "${signals.headlineText}" and does not make the offer concrete fast`
          : "there is no strong headline anchoring the offer on first glance",
      consequenceMechanics:
        "new visitors need extra seconds to understand what the business does and why it matters",
      reviewTime: "a quick messaging review",
      microYes: "Want the short rewrite angle?",
      previewAssetExists: true,
      evidence: [`Headline: ${signals.headlineText ?? "missing"}.`],
    });
  }

  if (!signals.hasSocialProof) {
    candidates.push({
      score: 74,
      issueType: "weak_social_proof",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the main offer has very little immediate proof around it",
      recognizableReason:
        "I did not spot strong reviews, testimonials, case studies, or trust markers near the main offer",
      consequenceMechanics:
        "buyers have less reason to believe the promise before deciding whether to reach out",
      reviewTime: "a 4-minute conversion review",
      microYes: "Want me to send the trust-fix note?",
      previewAssetExists: true,
      evidence: [`Social proof detected: ${signals.hasSocialProof ? "yes" : "no"}.`],
    });
  }

  if (signals.sitemapUrlCount > 0 && signals.sitemapUrlCount <= 3 && signals.internalLinkCount < 6) {
    candidates.push({
      score: 66,
      issueType: "low_page_depth",
      pageUrl: signals.sitemapUrl ?? signals.websiteUrl,
      pageLabel: signals.sitemapXml ? "sitemap.xml" : "homepage",
      summary: "the site footprint looks thin for broader search coverage",
      recognizableReason:
        `the sitemap only exposed ${signals.sitemapUrlCount} URL(s) and the homepage showed ${signals.internalLinkCount} internal link(s)`,
      consequenceMechanics:
        "topic coverage and long-tail discovery stay capped because there are not many crawlable paths to work with",
      reviewTime: "a short SEO review",
      microYes: "Want me to send the growth-angle note?",
      previewAssetExists: false,
      evidence: [
        `Sitemap URLs: ${signals.sitemapUrlCount}.`,
        `Homepage internal links: ${signals.internalLinkCount}.`,
      ],
    });
  }

  if (signals.hasPhone && !signals.hasForm) {
    candidates.push({
      score: 72,
      issueType: "manual_process_signal",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "the inquiry path looks heavily manual from the outside",
      recognizableReason:
        "the site shows direct phone/contact information but little sign of a streamlined capture path",
      consequenceMechanics:
        "leads often end up depending on someone noticing and responding manually instead of moving cleanly into the next step",
      reviewTime: "a 4-minute automation review",
      microYes: "Want me to send the workflow angle?",
      previewAssetExists: true,
      evidence: [
        `Phone visible: ${signals.hasPhone ? "yes" : "no"}.`,
        `Form present: ${signals.hasForm ? "yes" : "no"}.`,
      ],
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      score: 30,
      issueType: "generic_opportunity",
      pageUrl: signals.websiteUrl,
      pageLabel: "homepage",
      summary: "there is still a worthwhile polish opportunity on the homepage",
      recognizableReason:
        "the page loads, but the conversion path and proof stack can still be sharpened from a cold-traffic point of view",
      consequenceMechanics:
        "small clarity gains compound when new visitors decide whether to stay, trust, and act",
      reviewTime: "a short review",
      microYes: "Want me to send the quick note?",
      previewAssetExists: true,
      evidence: [
        `Title: ${signals.title ?? "missing"}.`,
        `Headline: ${signals.headlineText ?? "missing"}.`,
      ],
    });
  }

  return candidates;
}

function chooseCandidateForService(serviceKey: ServiceKey, candidates: CandidateFinding[]) {
  const preferenceOrder: Record<ServiceKey, AuditIssueType[]> = {
    seo: [
      "missing_sitemap",
      "missing_meta_description",
      "missing_h1",
      "missing_canonical",
      "low_page_depth",
      "generic_opportunity",
    ],
    webdesign: [
      "missing_cta",
      "weak_headline",
      "weak_social_proof",
      "missing_contact_path",
      "generic_opportunity",
    ],
    lead_capture: [
      "missing_contact_path",
      "missing_cta",
      "manual_process_signal",
      "weak_headline",
      "generic_opportunity",
    ],
    copywriting: ["weak_headline", "missing_cta", "generic_opportunity"],
    marketing: ["weak_social_proof", "weak_headline", "missing_cta", "generic_opportunity"],
    ai_automation: [
      "manual_process_signal",
      "missing_contact_path",
      "missing_cta",
      "generic_opportunity",
    ],
  };

  const ranking = new Map(preferenceOrder[serviceKey].map((issue, index) => [issue, index]));

  return [...candidates].sort((a, b) => {
    const rankA = ranking.get(a.issueType) ?? 999;
    const rankB = ranking.get(b.issueType) ?? 999;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return b.score - a.score;
  })[0];
}

function buildSubjectLine(lead: Lead, serviceKey: ServiceKey, finding: CandidateFinding) {
  const prefix: Record<ServiceKey, string> = {
    seo: "Quick SEO issue I spotted",
    webdesign: "Quick homepage note",
    lead_capture: "Quick lead-capture note",
    copywriting: "Quick copy note",
    marketing: "Quick conversion note",
    ai_automation: "Quick workflow note",
  };

  const page = finding.pageLabel ? ` on ${finding.pageLabel}` : "";
  return `${prefix[serviceKey]} for ${lead.companyName}${page}`;
}

function buildVariables(
  lead: Lead,
  serviceKey: ServiceKey,
  finding: CandidateFinding,
  contactName?: string | null,
): ProspectVariableBag {
  const page = finding.pageLabel ?? finding.pageUrl ?? "the homepage";

  return {
    SUBJECT_LINE: buildSubjectLine(lead, serviceKey, finding),
    NAME: contactName ?? "there",
    COMPANY: lead.companyName,
    PAGE: page,
    WEBSITE_PROBLEM: finding.summary,
    RECOGNIZABLE_REASON: finding.recognizableReason,
    CONSEQUENCE_MECHANICS: finding.consequenceMechanics,
    REVIEW_TIME: finding.reviewTime,
    MICRO_YES: finding.microYes,
    PREVIEW_ASSET_EXISTS: finding.previewAssetExists
      ? "I can include an annotated preview if useful."
      : "I can keep it to a short plain-text review.",
    SERVICE: serviceKey,
    YOUR_NAME: "John",
    WEBSITE: lead.websiteUri ?? "",
  };
}

export async function auditLeadWebsite({
  lead,
  serviceKey,
  contactName,
}: {
  lead: Lead;
  serviceKey: ServiceKey;
  contactName?: string | null;
}): Promise<AuditOutcome> {
  if (!lead.websiteUri) {
    const finding: CandidateFinding = {
      score: 100,
      issueType: "generic_opportunity",
      pageUrl: null,
      pageLabel: "website",
      summary: "there is no public website connected to the business listing",
      recognizableReason:
        "the Google Maps lead already arrives without a website URL, which makes discovery and conversion harder from the first touch",
      consequenceMechanics:
        "buyers have no owned page to verify the offer or take the next step from",
      reviewTime: "a short review",
      microYes: "Want me to send the quick idea?",
      previewAssetExists: false,
      evidence: ["Lead has no website URI stored."],
    };

    return {
      finding: {
        ...finding,
        rawSignals: {
          issueType: finding.issueType,
          missingWebsite: true,
        },
      },
      variables: buildVariables(lead, serviceKey, finding, contactName),
    };
  }

  const signals = await collectSignals(lead);
  const chosen = chooseCandidateForService(serviceKey, buildCommonCandidates(signals));

  return {
    finding: {
      ...chosen,
      rawSignals: {
        issueType: chosen.issueType,
        issueLabel: formatIssueLabel(chosen.issueType),
        websiteUrl: signals.websiteUrl,
        homepageStatus: signals.homepageStatus,
        sitemapUrl: signals.sitemapUrl,
        sitemapUrlCount: signals.sitemapUrlCount,
        title: signals.title,
        metaDescription: signals.metaDescription,
        canonicalUrl: signals.canonicalUrl,
        h1s: signals.h1s,
        internalLinkCount: signals.internalLinkCount,
        hasForm: signals.hasForm,
        hasVisibleCta: signals.hasVisibleCta,
        hasPhone: signals.hasPhone,
        hasEmail: signals.hasEmail,
        hasSocialProof: signals.hasSocialProof,
        headlineText: signals.headlineText,
        fetchError: signals.fetchError,
      },
    },
    variables: buildVariables(lead, serviceKey, chosen, contactName),
  };
}
