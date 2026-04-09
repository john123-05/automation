import { NextResponse } from "next/server";
import { hasDocumentsAccess } from "@/lib/documents/auth";
import { saveUploadedDocument } from "@/lib/documents/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await hasDocumentsAccess())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const candidate = formData.get("document");

  if (!(candidate instanceof File)) {
    return NextResponse.json({ ok: false, error: "Please choose a PDF file." }, { status: 400 });
  }

  const isPdfType = candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");

  if (!isPdfType) {
    return NextResponse.json({ ok: false, error: "Only PDF files are supported." }, { status: 400 });
  }

  try {
    const document = await saveUploadedDocument(candidate);

    return NextResponse.json({
      ok: true,
      document: {
        slug: document.slug,
        title: document.title,
        fileName: document.fileName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
