"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SuppressRecipientButton({
  email,
  reason = "Manually suppressed from inbox.",
}: {
  email: string;
  reason?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage("");
            const response = await fetch("/api/inbox/suppress", {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                email,
                reason,
              }),
            });
            const payload = (await response.json()) as { ok: boolean; error?: string };

            if (!response.ok || !payload.ok) {
              setMessage(payload.error ?? "Suppression failed.");
              return;
            }

            router.refresh();
          })
        }
        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Suppressing..." : "Suppress"}
      </button>
      {message ? <p className="text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
