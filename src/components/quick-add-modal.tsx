"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type QuickAddModalProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerClassName?: string;
  children: React.ReactNode;
};

export function QuickAddModal({
  title,
  description,
  triggerLabel,
  triggerClassName,
  children,
}: QuickAddModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        }
      >
        {triggerLabel}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
              <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-[#f8f4ea] shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Quick add</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
                    {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-lg text-slate-700 transition hover:bg-slate-50"
                    aria-label={`Close ${title}`}
                  >
                    ×
                  </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
