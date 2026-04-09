"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ApproveSequenceButton({ sequenceId }: { sequenceId: string }) {
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
            const response = await fetch("/api/sequences/approve", {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                sequenceIds: [sequenceId],
              }),
            });
            const payload = (await response.json()) as { ok: boolean; error?: string };

            if (!response.ok || !payload.ok) {
              setMessage(payload.error ?? "Approval failed.");
              return;
            }

            router.refresh();
          });
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Approving..." : "Approve"}
      </button>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}
