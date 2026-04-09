"use client";

import { useFormStatus } from "react-dom";

export function FormPendingIndicator({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-white/75 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <span className="inline-flex size-2 rounded-full bg-slate-900 animate-pulse" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-2/3 rounded-full bg-slate-900 animate-pulse" />
      </div>
    </div>
  );
}
