"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type MobileDrawerProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function MobileDrawer({ title, children, className }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${title}`}
        className={
          className ??
          "inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-strong text-foreground transition hover:opacity-90"
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] bg-slate-950/45 p-4">
              <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-line bg-surface-strong text-foreground shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-muted">Menu</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-lg text-foreground transition hover:opacity-90"
                    aria-label={`Close ${title}`}
                  >
                    ×
                  </button>
                </div>
                <div className="scroll-slim flex-1 overflow-y-auto px-5 py-5">{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
