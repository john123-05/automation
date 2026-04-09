"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SequenceStepEditor({
  sequenceId,
  stepNumber,
  initialSubject,
  initialBody,
  isSent,
}: {
  sequenceId: string;
  stepNumber: 1 | 2 | 3 | 4;
  initialSubject: string;
  initialBody: string;
  isSent: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const isDirty = subject !== initialSubject || body !== initialBody;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setStatus("idle");

    startTransition(async () => {
      const response = await fetch("/api/sequences/update-step", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sequenceId,
          stepNumber,
          subject,
          body,
        }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Step update failed.");
        return;
      }

      setStatus("success");
      setMessage("Step saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Subject</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={isPending || isSent}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Body</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={12}
          disabled={isPending || isSent}
          className="w-full rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || isSent || !isDirty}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save step"}
        </button>
        {isSent ? (
          <p className="text-sm text-slate-500">Sent steps are locked.</p>
        ) : message ? (
          <p className={`text-sm ${status === "error" ? "text-danger" : "text-slate-700"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
