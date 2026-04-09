"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ManualReplyForm({
  mailboxId,
  threadId,
  toEmail,
  defaultSubject,
}: {
  mailboxId: string;
  threadId: string;
  toEmail: string;
  defaultSubject: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyText, setBodyText] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");

        startTransition(async () => {
          const response = await fetch("/api/messages/send", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              mode: "manual",
              mailboxId,
              threadId,
              toEmail,
              subject,
              bodyText,
            }),
          });
          const payload = (await response.json()) as { ok: boolean; error?: string };

          if (!response.ok || !payload.ok) {
            setMessage(payload.error ?? "Reply failed.");
            return;
          }

          setBodyText("");
          setMessage("Reply sent.");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Subject</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-2xl border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-slate-900"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Reply</span>
        <textarea
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          rows={5}
          className="w-full rounded-[24px] border border-line bg-white/85 px-4 py-3 outline-none transition focus:border-slate-900"
          placeholder="Write a manual reply..."
          required
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send Reply"}
        </button>
        {message ? (
          <p className={`text-sm ${message.includes("failed") ? "text-danger" : "text-slate-700"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
