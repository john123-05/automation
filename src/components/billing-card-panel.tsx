"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { BillingCard, BillingCardStatus } from "@/lib/billing/types";
import { formatDateTime } from "@/lib/sales-machine/utils";

function billingStatusClasses(status: BillingCardStatus) {
  switch (status) {
    case "ready":
      return "bg-emerald-100 text-emerald-800";
    case "setup-needed":
      return "bg-amber-100 text-amber-900";
    case "error":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export function BillingCardPanel({
  title,
  titleSuffix,
  scopeLabel,
  summary,
  status,
  statusLabel,
  metrics,
  lastUpdatedAt,
  refreshPath,
}: BillingCard) {
  const router = useRouter();
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tooltipLines = useMemo(
    () => [
      scopeLabel,
      ...summary
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      lastUpdatedAt ? `Updated ${formatDateTime(lastUpdatedAt)}` : "No live data yet",
    ],
    [lastUpdatedAt, scopeLabel, summary],
  );

  return (
    <>
      <div className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted sm:text-sm sm:tracking-[0.18em]">
                {title}
              </p>
              {titleSuffix ? (
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
                  {titleSuffix}
                </p>
              ) : null}
              <button
                type="button"
                onMouseEnter={(event) => setTooltipRect(event.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => setTooltipRect(null)}
                onFocus={(event) => setTooltipRect(event.currentTarget.getBoundingClientRect())}
                onBlur={() => setTooltipRect(null)}
                className="inline-flex size-4.5 items-center justify-center rounded-full border border-line bg-white text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 sm:size-5 sm:text-[11px]"
                aria-label={`More info for ${title}`}
              >
                i
              </button>
              {refreshPath ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (isRefreshing) {
                      return;
                    }

                    setIsRefreshing(true);

                    try {
                      const response = await fetch(refreshPath, {
                        method: "POST",
                      });
                      const payload = (await response.json()) as { ok?: boolean };

                      if (!response.ok || !payload.ok) {
                        throw new Error("Billing refresh failed.");
                      }

                      router.refresh();
                    } catch (error) {
                      console.error(error);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="inline-flex rounded-full border border-line bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-2.5 sm:text-[11px]"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              ) : null}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:text-xs ${billingStatusClasses(
              status,
            )}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[18px] border border-line bg-white/70 p-3 sm:rounded-[22px] sm:p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted sm:text-xs sm:tracking-[0.16em]">
                {metric.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950 sm:mt-3 sm:text-2xl">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {tooltipRect && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[60] w-max max-w-[260px] rounded-2xl border border-line bg-[#f8f4ea] px-4 py-3 text-sm text-slate-700 shadow-xl"
              style={{
                top: tooltipRect.bottom + 10,
                left: Math.max(16, tooltipRect.left - 10),
              }}
            >
              {tooltipLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
