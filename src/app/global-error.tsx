"use client";

import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const message = error?.message?.trim() || "Something went wrong while loading Fieldflow.";

  return (
    <html lang="en" className="h-full theme-light">
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10 sm:px-6">
          <section className="glass-panel w-full rounded-[34px] p-8">
            <p className="text-sm uppercase tracking-[0.18em] text-muted">Global Error</p>
            <title>Fieldflow Error</title>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">Fieldflow hit a runtime error</h1>
            <p className="mt-3 text-sm text-slate-600">
              The app failed while rendering this page. Retry once first. If it keeps happening,
              reopen the app or redeploy the current version.
            </p>
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => unstable_retry()}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
