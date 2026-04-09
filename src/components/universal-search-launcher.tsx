"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/copy";
import type { Contact, Lead } from "@/lib/sales-machine/types";
import type { UiLanguage } from "@/lib/ui-settings-shared";

type SearchableLead = {
  lead: Lead;
  contacts: Contact[];
};

function buildSearchText(entry: SearchableLead) {
  const contactText = entry.contacts
    .map((contact) =>
      [
        contact.name,
        contact.title,
        contact.email,
        contact.linkedin,
        contact.instagram,
        contact.twitter,
        contact.facebook,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");

  return [
    entry.lead.companyName,
    entry.lead.address,
    entry.lead.niche,
    entry.lead.locationLabel,
    entry.lead.websiteUri,
    entry.lead.nationalPhoneNumber,
    entry.lead.internationalPhoneNumber,
    entry.lead.researchSummary,
    contactText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function UniversalSearchLauncher({
  leads,
  contacts,
  language = "en",
  triggerLabel,
  triggerClassName,
}: {
  leads: Lead[];
  contacts: Contact[];
  language?: UiLanguage;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  function jumpToLead(leadId: string) {
    const target = document.getElementById(`lead-${leadId}`) as HTMLDetailsElement | null;

    if (!target) {
      setIsOpen(false);
      return;
    }

    target.open = true;
    setIsOpen(false);

    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const searchableLeads = useMemo(() => {
    return leads.map((lead) => ({
      lead,
      contacts: contacts.filter((contact) => contact.leadId === lead.id),
    }));
  }, [contacts, leads]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return searchableLeads.slice(0, 8);
    }

    return searchableLeads
      .map((entry) => ({
        entry,
        haystack: buildSearchText(entry),
      }))
      .filter(({ haystack }) => haystack.includes(trimmed))
      .slice(0, 10)
      .map(({ entry }) => entry);
  }, [query, searchableLeads]);

  const hasMatches = results.length > 0;
  const usesCustomTrigger = Boolean(triggerLabel || triggerClassName);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "inline-flex size-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800"
        }
        aria-label={t(language, "searchLeadsAndContacts")}
        title={t(language, "searchLeadsAndContacts")}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={usesCustomTrigger ? "size-4 shrink-0" : "size-5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {usesCustomTrigger ? (
          <span className="min-w-0 truncate text-left">
            {triggerLabel ?? t(language, "searchLeadsAndContacts")}
          </span>
        ) : (
          <span className="sr-only">{t(language, "searchLeadsAndContacts")}</span>
        )}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 pt-16">
          <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-[#f8f4ea] shadow-2xl">
            <div className="border-b border-line px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "universalSearch")}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {t(language, "searchLeadsAndContacts")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-lg text-slate-700 transition hover:bg-slate-50"
                  aria-label={t(language, "closeUniversalSearch")}
                >
                  ×
                </button>
              </div>

              <div className="mt-4">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(language, "searchPlaceholder")}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900"
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {hasMatches ? (
                <div className="space-y-6">
                  {results.length ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{t(language, "pipeline")}</p>
                        <p className="text-xs text-slate-500">{results.length} {t(language, "matches")}</p>
                      </div>
                      {results.map(({ lead, contacts: leadContacts }) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            jumpToLead(lead.id);
                          }}
                          className="block w-full rounded-[24px] border border-line bg-white/75 px-5 py-4 text-left transition hover:bg-white"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-slate-950">{lead.companyName}</p>
                              <p className="mt-1 text-sm text-slate-600">{lead.address}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span>{lead.niche}</span>
                                <span>•</span>
                                <span>{lead.locationLabel}</span>
                                <span>•</span>
                                <span>{lead.contactCount} {t(language, "contacts").toLowerCase()}</span>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {lead.stage}
                            </div>
                          </div>

                          {leadContacts.length ? (
                            <div className="mt-3 text-sm text-slate-700">
                              {leadContacts.slice(0, 2).map((contact) => (
                                <p key={contact.id}>
                                  {contact.name}
                                  {contact.title ? ` · ${contact.title}` : ""}
                                </p>
                              ))}
                              {leadContacts.length > 2 ? (
                                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                                  +{leadContacts.length - 2} {t(language, "moreContacts")}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                </div>
              ) : (
                <p className="rounded-[24px] border border-dashed border-line px-4 py-10 text-center text-sm text-slate-600">
                  {t(language, "noMatchesFound")}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
