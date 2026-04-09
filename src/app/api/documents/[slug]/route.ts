import { NextResponse } from "next/server";
import { hasDocumentsAccess } from "@/lib/documents/auth";
import { getDocumentPayload } from "@/lib/documents/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildInlineFileName(fileName: string) {
  return `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, context: RouteContext<"/api/documents/[slug]">) {
  if (!(await hasDocumentsAccess())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug } = await context.params;
  const payload = await getDocumentPayload(slug);

  if (!payload) {
    return new NextResponse("Document not found", { status: 404 });
  }

  return new NextResponse(payload.bytes, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": buildInlineFileName(payload.document.fileName),
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
