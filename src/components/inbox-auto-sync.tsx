"use client";

import { useEffect } from "react";

type InboxAutoSyncProps = {
  enabled: boolean;
  intervalSeconds: number;
};

export function InboxAutoSync({ enabled, intervalSeconds }: InboxAutoSyncProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalMs = Math.max(15, intervalSeconds) * 1000;
    let isRunning = false;

    const runSync = async () => {
      if (isRunning) {
        return;
      }

      isRunning = true;

      try {
        const response = await fetch("/api/inbox/sync", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          syncedThreads?: number;
          syncedMessages?: number;
        };

        if (response.ok && payload.ok) {
          window.dispatchEvent(
            new CustomEvent("fieldflow:inbox-synced", {
              detail: {
                syncedThreads: payload.syncedThreads ?? 0,
                syncedMessages: payload.syncedMessages ?? 0,
              },
            }),
          );
        }
      } catch {
        // Background polling should stay silent if the local server is sleeping or offline.
      } finally {
        isRunning = false;
      }
    };

    void runSync();
    const timer = window.setInterval(() => {
      void runSync();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalSeconds]);

  return null;
}
