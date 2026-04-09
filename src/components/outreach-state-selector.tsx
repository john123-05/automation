"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { OutreachStateStatus } from "@/lib/sales-machine/types";

const states: OutreachStateStatus[] = [
  "drafted",
  "approved",
  "scheduled",
  "sent",
  "replied",
  "booked",
  "nurture",
  "closed",
  "needs_escalation",
  "no_show",
];

export function OutreachStateSelector({
  stateId,
  value,
}: {
  stateId: string;
  value: OutreachStateStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(event) => {
        const nextValue = event.target.value as OutreachStateStatus;

        startTransition(async () => {
          await fetch("/api/inbox/state", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              stateId,
              state: nextValue,
            }),
          });
          router.refresh();
        });
      }}
      className="rounded-full border border-line bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {states.map((state) => (
        <option key={state} value={state}>
          {state}
        </option>
      ))}
    </select>
  );
}
