"use client";

import Link from "next/link";
import { useState } from "react";

type OutreachSidebarItem = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  active: boolean;
};

function SidebarIcon({ id }: { id: string }) {
  switch (id) {
    case "campaigns":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M4 6.5h16M4 12h16M4 17.5h10"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "sequences":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M7 6h10M7 12h7M7 18h10M4 6h.01M4 12h.01M4 18h.01"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "setup":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M10.5 3.5h3l.6 2.3a6.8 6.8 0 0 1 1.8.8l2-1.1 2.1 2.1-1.1 2a6.8 6.8 0 0 1 .8 1.8l2.3.6v3l-2.3.6a6.8 6.8 0 0 1-.8 1.8l1.1 2-2.1 2.1-2-1.1a6.8 6.8 0 0 1-1.8.8l-.6 2.3h-3l-.6-2.3a6.8 6.8 0 0 1-1.8-.8l-2 1.1-2.1-2.1 1.1-2a6.8 6.8 0 0 1-.8-1.8L3.5 13.5v-3l2.3-.6a6.8 6.8 0 0 1 .8-1.8l-1.1-2 2.1-2.1 2 1.1a6.8 6.8 0 0 1 1.8-.8Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "variables":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "templates":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "mailboxes":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M4 7.5h16v9H4zM4 8l8 6 8-6"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path
            d="M4 6.5h16v11H4zM8 17.5h8M8 10h8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    default:
      return <span className="text-xs font-semibold">{id.slice(0, 1).toUpperCase()}</span>;
  }
}

function SidebarItem({
  item,
  expanded,
}: {
  item: OutreachSidebarItem;
  expanded: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={`flex items-center rounded-[20px] border transition ${
        expanded ? "gap-3 px-3.5 py-3" : "justify-center px-3 py-3"
      } ${
        item.active
          ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_35px_rgba(15,23,42,0.22)]"
          : "border-line bg-white/70 text-slate-700 hover:bg-white"
      }`}
    >
      <span
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
          item.active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
        }`}
      >
        <SidebarIcon id={item.id} />
      </span>
      {expanded ? (
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-tight">{item.label}</span>
      ) : null}
    </Link>
  );
}

export function OutreachSidebar({
  items,
  workspaceHref,
}: {
  items: OutreachSidebarItem[];
  workspaceHref: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`glass-panel rounded-[32px] p-3 transition-[width] duration-200 ${
        expanded ? "w-[244px]" : "w-[72px]"
      }`}
    >
      <div className={`flex items-center gap-2 ${expanded ? "justify-between" : "justify-center"}`}>
        <div
          className={`flex items-center justify-center rounded-[24px] bg-slate-950 px-3 py-4 text-sm font-semibold text-white ${
            expanded ? "min-w-[48px]" : ""
          }`}
        >
          OD
        </div>
        {expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Collapse sidebar"
            className="inline-flex size-10 items-center justify-center rounded-[18px] border border-line bg-white/75 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4">
              <path
                d="M14.5 6.5 9 12l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand sidebar"
          className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] border border-line bg-white/75 px-3 py-2.5 text-slate-700 transition hover:bg-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              d="M9.5 6.5 15 12l-5.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      ) : null}

      <nav className="mt-4 space-y-3">
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} expanded={expanded} />
        ))}
      </nav>

      <div className="mt-4 border-t border-line pt-4">
        <Link
          href={workspaceHref}
          aria-label="Workspace"
          title="Workspace"
          className={`flex items-center rounded-[20px] border border-line bg-white/75 text-sm font-medium text-slate-700 transition hover:bg-white ${
            expanded ? "gap-3 px-3.5 py-3" : "justify-center px-3 py-3"
          }`}
        >
          <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <svg viewBox="0 0 24 24" aria-hidden className="size-4">
              <path
                d="M4.5 6.5h15v11h-15zM8 10h8M8 14h5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </span>
          {expanded ? <span className="min-w-0 flex-1 leading-tight">Workspace</span> : null}
        </Link>
      </div>
    </div>
  );
}
