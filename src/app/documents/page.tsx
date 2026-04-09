import Link from "next/link";
import { DocumentsShell } from "@/components/documents-shell";
import { requireAppAccess } from "@/lib/app-auth";
import { hasDocumentsAccess, isDocumentsAuthEnabled } from "@/lib/documents/auth";
import { listAvailableDocuments } from "@/lib/documents/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? null : null;
}

function formatBytes(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "PDF";
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(0)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Unknown source date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  await requireAppAccess("/documents");
  const params = (searchParams ? await searchParams : undefined) ?? {};
  const authEnabled = isDocumentsAuthEnabled();
  const hasAccess = await hasDocumentsAccess();
  const requestedSlug = readSearchParam(params.doc);
  const authError = readSearchParam(params.authError);

  const documents = authEnabled && !hasAccess ? [] : await listAvailableDocuments();
  const selectedDocument =
    documents.find((document) => document.slug === requestedSlug) ?? documents[0] ?? null;
  const documentsForShell = documents.map((document) => ({
    slug: document.slug,
    title: document.title,
    sizeLabel: formatBytes(document.sizeBytes),
    sourceLabel:
      document.source === "supabase" ? "Supabase private bucket" : "Private local folder",
    updatedLabel: formatUpdatedAt(document.updatedAt),
  }));

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1700px] flex-col gap-6 overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <section className="glass-panel rounded-[36px] px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
              >
                Back
              </Link>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Documents</p>
            </div>
            <div>
              <h1 className="text-[clamp(1.9rem,4vw,3.8rem)] font-semibold leading-[0.95] text-slate-950">
                Private PDF vault
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              Workspace
            </Link>
            <Link
              href="/outreach"
              className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              Outreach
            </Link>
            {authEnabled && hasAccess ? (
              <form action="/api/documents/session" method="post">
                <input type="hidden" name="intent" value="logout" />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
                >
                  Lock
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      {authEnabled && !hasAccess ? (
        <section className="glass-panel mx-auto w-full max-w-[640px] rounded-[32px] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-slate-500">Protected access</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Unlock confidential PDFs</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter the documents password to unlock the embedded viewer and download route.
          </p>

          <form action="/api/documents/session" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="redirectTo" value="/documents" />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-800">Password</span>
              <input
                required
                name="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-[22px] border border-line bg-white/90 px-4 py-3 outline-none transition focus:border-slate-950"
              />
            </label>

            {authError === "invalid_password" ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                The password was not correct. Try again.
              </div>
            ) : null}

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Unlock documents
            </button>
          </form>
        </section>
      ) : null}

      {!authEnabled || hasAccess ? (
        <>
          {documents.length === 0 ? (
            <section className="glass-panel rounded-[32px] p-6 sm:p-8">
              <p className="text-sm uppercase tracking-[0.26em] text-slate-500">No documents found</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">Nothing is loaded yet</h2>
              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                <p>
                  Put the PDFs in <code>~/Downloads/Wichtige Dokumente</code>, or set
                  <code> DOCUMENTS_DIR</code> to a private folder outside <code>public/</code>.
                </p>
                <p>
                  If you want Supabase instead, create a private bucket and set
                  <code> SUPABASE_DOCUMENTS_BUCKET</code> plus an optional
                  <code> SUPABASE_DOCUMENTS_PREFIX</code>.
                </p>
              </div>
            </section>
          ) : (
            <DocumentsShell
              documents={documentsForShell}
              initialSelectedSlug={selectedDocument?.slug ?? null}
            />
          )}
        </>
      ) : null}
    </main>
  );
}
