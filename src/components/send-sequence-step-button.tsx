"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SendSequenceStepButton({
  sequenceId,
  stepNumber,
}: {
  sequenceId: string;
  stepNumber: number;
}) {
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
            const response = await fetch("/api/messages/send", {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                mode: "sequence",
                sequenceId,
                stepNumber,
              }),
            });
            const payload = (await response.json()) as { ok: boolean; error?: string };

            if (!response.ok || !payload.ok) {
              setMessage(payload.error ?? "Send failed.");
              return;
            }

            router.refresh();
          });
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Sending..." : `Send Day ${stepNumber}`}
      </button>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}
