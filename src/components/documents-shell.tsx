"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { MobileDrawer } from "@/components/mobile-drawer";

type DocumentsShellItem = {
  slug: string;
  title: string;
  sizeLabel: string;
  sourceLabel: string;
  updatedLabel: string;
};

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        d="M8 4.5h6l4 4v11H8z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14 4.5v4h4M10 12h6M10 16h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function DocumentsShell({
  documents,
  initialSelectedSlug,
}: {
  documents: DocumentsShellItem[];
  initialSelectedSlug: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isPresenting, setIsPresenting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const selectedDocument =
    documents.find((document) => document.slug === initialSelectedSlug) ?? documents[0] ?? null;

  function handleUploadTrigger() {
    setUploadMessage("");
    fileInputRef.current?.click();
  }

  async function handlePresentationToggle() {
    if (!viewerRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsPresenting(false);
        return;
      }

      await viewerRef.current.requestFullscreen();
      setIsPresenting(true);
    } catch {
      setUploadMessage("Fullscreen mode is not available in this preview.");
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsPresenting(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    setUploadMessage("");
    startTransition(async () => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        document?: { slug: string };
      };

      if (!response.ok || !payload.ok || !payload.document) {
        setUploadMessage(payload.error ?? "Upload failed.");
        input.value = "";
        return;
      }

      router.push(`/documents?doc=${payload.document.slug}`, { scroll: false });
      router.refresh();
      setLibraryExpanded(true);
      input.value = "";
    });
  }

  return (
    <section
      className={`min-h-0 flex-1 grid gap-4 transition-all duration-200 sm:gap-5 ${
        libraryExpanded ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]" : "lg:grid-cols-[72px_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`glass-panel hidden min-h-0 overflow-hidden rounded-[32px] transition-all duration-200 lg:block ${
          libraryExpanded ? "p-4 sm:p-5" : "p-3"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={`flex items-center gap-2 ${libraryExpanded ? "justify-between" : "justify-center"}`}
          >
            <div
              className={`inline-flex items-center justify-center rounded-[22px] bg-slate-950 text-white ${
                libraryExpanded ? "min-h-[52px] min-w-[52px]" : "size-12"
              }`}
            >
              <DocumentIcon />
            </div>

            {libraryExpanded ? (
              <button
                type="button"
                onClick={() => setLibraryExpanded(false)}
                aria-expanded={libraryExpanded}
                aria-label="Collapse library"
                className="inline-flex size-10 items-center justify-center rounded-[18px] border border-line bg-white/75 text-slate-700 transition hover:bg-white"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                  <path
                    d="M14.5 6.5 9 12l5.5 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            ) : null}
          </div>

          {libraryExpanded ? (
            <>
              <div className="mt-4 shrink-0">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Library</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">{documents.length} PDFs</h2>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 max-lg:max-h-[48vh] lg:max-h-[calc(100vh-18rem)]">
                {documents.map((document) => {
                  const active = selectedDocument?.slug === document.slug;

                  return (
                    <Link
                      key={document.slug}
                      href={`/documents?doc=${document.slug}`}
                      scroll={false}
                      className={`block rounded-[24px] border px-4 py-4 transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
                          : "border-line bg-white/80 text-slate-800 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5">{document.title}</p>
                          <p
                            className={`mt-2 text-xs uppercase tracking-[0.18em] ${
                              active ? "text-white/70" : "text-slate-500"
                            }`}
                          >
                            {document.sourceLabel}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {document.sizeLabel}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLibraryExpanded(true)}
              aria-expanded={libraryExpanded}
              aria-label="Expand library"
              className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] border border-line bg-white/75 px-3 py-2.5 text-slate-700 transition hover:bg-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                <path
                  d="M9.5 6.5 15 12l-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          )}
        </div>
      </aside>

      <div
        ref={viewerRef}
        className="glass-panel min-h-0 overflow-hidden rounded-[24px] bg-background sm:rounded-[32px]"
      >
        {selectedDocument ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm sm:tracking-[0.24em]">
                    Viewer
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
                    {selectedDocument.title}
                  </h2>
                  <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                    Updated {selectedDocument.updatedLabel}
                  </p>
                </div>

                <div className="hidden flex-wrap items-center gap-3 sm:flex">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileSelection}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleUploadTrigger}
                    disabled={isPending}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Uploading..." : "Upload new document"}
                  </button>

                  <button
                    type="button"
                    onClick={handlePresentationToggle}
                    aria-label={isPresenting ? "Exit presentation mode" : "Enter presentation mode"}
                    title={isPresenting ? "Exit presentation mode" : "Presentation mode"}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white/80 text-slate-900 transition hover:bg-white"
                  >
                    {isPresenting ? (
                      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                        <path
                          d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                        <path
                          d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8 8h8v8H8z"
                          fill="none"
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                        />
                      </svg>
                    )}
                  </button>

                  <a
                    href={`/api/documents/${selectedDocument.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
                  >
                    Open in new tab
                  </a>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 lg:hidden">
                <MobileDrawer title="Document library">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Library</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{documents.length} PDFs</h2>
                    </div>

                    <div className="space-y-3">
                      {documents.map((document) => {
                        const active = selectedDocument?.slug === document.slug;

                        return (
                          <Link
                            key={document.slug}
                            href={`/documents?doc=${document.slug}`}
                            scroll={false}
                            className={`block rounded-[20px] border px-4 py-3 transition ${
                              active
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-line bg-white text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5">{document.title}</p>
                                <p
                                  className={`mt-2 text-[10px] uppercase tracking-[0.16em] ${
                                    active ? "text-white/70" : "text-slate-500"
                                  }`}
                                >
                                  {document.sourceLabel}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                                  active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {document.sizeLabel}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </MobileDrawer>

                <button
                  type="button"
                  onClick={handleUploadTrigger}
                  disabled={isPending}
                  className="inline-flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-slate-950 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Uploading..." : "Upload PDF"}
                </button>

                <button
                  type="button"
                  onClick={handlePresentationToggle}
                  aria-label={isPresenting ? "Exit full view" : "Open full view"}
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-3 py-2 text-[11px] font-medium text-slate-900 transition hover:bg-white"
                >
                  {isPresenting ? "Exit" : "Full view"}
                </button>

                <a
                  href={`/api/documents/${selectedDocument.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-3 py-2 text-[11px] font-medium text-slate-900 transition hover:bg-white"
                >
                  Open
                </a>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelection}
                className="hidden"
              />
            </div>

            {uploadMessage ? (
              <div className="border-b border-line px-4 py-3 text-sm text-rose-700 sm:px-6">
                {uploadMessage}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 bg-white/55 p-2 sm:p-4">
              <iframe
                key={selectedDocument.slug}
                src={`/api/documents/${selectedDocument.slug}`}
                title={selectedDocument.title}
                className="h-full min-h-[78vh] w-full rounded-[18px] border border-line bg-white sm:min-h-[78vh] sm:rounded-[24px] lg:min-h-0"
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-sm text-slate-600">Pick a document to open it.</div>
        )}
      </div>
    </section>
  );
}
