"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function InboxSyncButton({ mailboxId }: { mailboxId?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const response = await fetch(
              mailboxId ? `/api/inbox/sync?mailboxId=${encodeURIComponent(mailboxId)}` : "/api/inbox/sync",
              {
                method: "GET",
                cache: "no-store",
              },
            );
            const payload = (await response.json()) as {
              ok: boolean;
              syncedThreads?: number;
              syncedMessages?: number;
              error?: string;
            };

            if (!response.ok || !payload.ok) {
              setMessage(payload.error ?? "Inbox sync failed.");
              return;
            }

            setMessage(
              `Synced ${payload.syncedThreads ?? 0} thread(s) and ${payload.syncedMessages ?? 0} message(s).`,
            );
            router.refresh();
          });
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Syncing..." : "Sync Inbox"}
      </button>
      {message ? (
        <p className={`text-sm ${message.includes("failed") ? "text-danger" : "text-slate-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
