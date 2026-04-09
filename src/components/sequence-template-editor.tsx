"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SequenceTemplateEditor({
  id,
  stepNumber,
  dayOffset,
  subjectTemplate,
  bodyTemplate,
}: {
  id: string;
  stepNumber: number;
  dayOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(subjectTemplate);
  const [body, setBody] = useState(bodyTemplate);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");

        startTransition(async () => {
          const response = await fetch("/api/sequences/templates", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              id,
              subjectTemplate: subject,
              bodyTemplate: body,
            }),
          });
          const payload = (await response.json()) as { ok: boolean; error?: string };

          if (!response.ok || !payload.ok) {
            setMessage(payload.error ?? "Template save failed.");
            return;
          }

          setMessage("Saved.");
          router.refresh();
        });
      }}
      className="space-y-3 rounded-[24px] border border-line bg-white/75 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-slate-900">
          Day {dayOffset + 1} · Step {stepNumber}
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Subject template</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-900"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Body template</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          className="w-full rounded-[24px] border border-line bg-white px-4 py-3 outline-none transition focus:border-slate-900"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save Template"}
        </button>
        {message ? (
          <p className={`text-sm ${message === "Saved." ? "text-slate-700" : "text-danger"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
