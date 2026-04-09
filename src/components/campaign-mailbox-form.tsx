"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type MailboxOption = {
  id: string;
  label: string;
};

export function CampaignMailboxForm({
  campaignId,
  mailboxId,
  options,
}: {
  campaignId: string;
  mailboxId: string | null;
  options: MailboxOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(mailboxId ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
      >
        <option value="">No mailbox assigned</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const response = await fetch(`/api/campaigns/${campaignId}/assign-mailbox`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  mailboxId: selected || null,
                }),
              });
              const payload = (await response.json()) as { ok: boolean; error?: string };

              if (!response.ok || !payload.ok) {
                setMessage(payload.error ?? "Mailbox assignment failed.");
                return;
              }

              router.refresh();
            })
          }
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save mailbox"}
        </button>
        {message ? <p className="text-xs text-rose-700">{message}</p> : null}
      </div>
    </div>
  );
}
