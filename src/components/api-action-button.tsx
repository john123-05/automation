"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ApiActionButtonProps = {
  endpoint: string;
  label: string;
  body?: Record<string, unknown>;
  className?: string;
};

export function ApiActionButton({
  endpoint,
  label,
  body,
  className,
}: ApiActionButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              body: body ? JSON.stringify(body) : undefined,
            });
            const payload = (await response.json()) as { ok: boolean; error?: string };

            if (!response.ok || !payload.ok) {
              setMessage(payload.error ?? "Action failed.");
              return;
            }

            router.refresh();
          });
        }}
        className={
          className ??
          "inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isPending ? "Working..." : label}
      </button>
      {message ? <p className="text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
