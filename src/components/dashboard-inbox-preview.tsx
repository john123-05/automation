"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/copy";
import type { EmailThread } from "@/lib/sales-machine/types";
import { formatDateTime } from "@/lib/sales-machine/utils";
import type { UiLanguage } from "@/lib/ui-settings-shared";

type DashboardInboxPreviewProps = {
  language: UiLanguage;
  threads: EmailThread[];
};

function inboxStateClasses(state: EmailThread["state"]) {
  switch (state) {
    case "booked":
      return "bg-emerald-100 text-emerald-800";
    case "replied":
      return "bg-cyan-100 text-cyan-900";
    case "nurture":
      return "bg-amber-100 text-amber-900";
    case "closed":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function formatInboxState(state: EmailThread["state"]) {
  switch (state) {
    case "booked":
      return "Booked";
    case "replied":
      return "Reply";
    case "nurture":
      return "Nurture";
    case "closed":
      return "Closed";
    default:
      return state;
  }
}

function safeFormatThreadDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown time";
  }

  try {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "Unknown time";
    }

    return formatDateTime(value);
  } catch {
    return "Unknown time";
  }
}

export function DashboardInboxPreview({
  language,
  threads,
}: DashboardInboxPreviewProps) {
  const router = useRouter();
  const [dismissedThreadIds, setDismissedThreadIds] = useState<string[]>([]);

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !dismissedThreadIds.includes(thread.id)),
    [dismissedThreadIds, threads],
  );

  useEffect(() => {
    const handleInboxSync = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { syncedThreads?: number; syncedMessages?: number } | undefined)
          : undefined;

      if ((detail?.syncedMessages ?? 0) > 0) {
        router.refresh();
      }
    };

    window.addEventListener("fieldflow:inbox-synced", handleInboxSync);

    return () => {
      window.removeEventListener("fieldflow:inbox-synced", handleInboxSync);
    };
  }, [router]);

  return (
    <div className="glass-panel flex min-h-[320px] flex-col rounded-[28px] p-5 xl:min-h-[356px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted">{t(language, "inbox")}</p>
          <p className="mt-2 text-sm text-slate-600">{t(language, "recentInboxActivity")}</p>
        </div>
        <Link
          href="/outreach/inbox"
          className="rounded-full border border-line bg-white/80 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-white"
        >
          {t(language, "openInbox")}
        </Link>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 scroll-slim">
        <div className="space-y-3">
          {visibleThreads.length ? (
            visibleThreads.map((thread) => (
              <div key={thread.id} className="relative rounded-[22px] border border-line bg-white/70 p-4">
                <button
                  type="button"
                  aria-label={t(language, "dismissInboxItem")}
                  title={t(language, "dismissInboxItem")}
                  onClick={() =>
                    setDismissedThreadIds((current) => [...current, thread.id])
                  }
                  className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                >
                  ×
                </button>
                <Link href={`/outreach/inbox?threadId=${thread.id}`} className="block pr-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">{thread.subject}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {thread.contactName ?? thread.contactEmail ?? t(language, "unknownContact")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${inboxStateClasses(thread.state)}`}
                    >
                      {formatInboxState(thread.state)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                    {thread.snippet?.trim() || thread.subject}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {safeFormatThreadDate(thread.lastMessageAt)}
                  </p>
                </Link>
              </div>
            ))
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-line px-4 py-10 text-center text-sm text-slate-600">
              {t(language, "noInboxActivity")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
