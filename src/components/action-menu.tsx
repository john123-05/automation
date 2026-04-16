import type { ReactNode } from "react";

function itemClasses(tone: "default" | "danger") {
  return tone === "danger"
    ? "text-rose-700 hover:bg-rose-50"
    : "text-slate-700 hover:bg-slate-50";
}

export function ActionMenu({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <details className="group relative">
      <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-slate-600 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        ...
      </summary>
      <div className="absolute right-0 top-10 z-20 min-w-[220px] rounded-lg border border-line bg-white p-1.5 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
        {children}
      </div>
    </details>
  );
}

export function ActionMenuForm({
  action,
  label,
  tone = "default",
}: Readonly<{
  action: () => void | Promise<void>;
  label: string;
  tone?: "default" | "danger";
}>) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${itemClasses(tone)}`}
      >
        <span>{label}</span>
      </button>
    </form>
  );
}

export function ActionMenuHint({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <p className="px-3 py-2 text-xs text-slate-500">{children}</p>;
}
