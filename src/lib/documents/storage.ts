import "server-only";

import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/sales-machine/supabase";

export type AvailableDocument = {
  slug: string;
  title: string;
  fileName: string;
  storagePath: string;
  sizeBytes: number | null;
  source: "local" | "supabase";
  updatedAt: string | null;
};

type LocalDocumentRecord = {
  absolutePath: string;
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
};

type ResolvedDocumentRecord =
  | {
      source: "local";
      fileName: string;
      absolutePath: string;
      sizeBytes: number;
      updatedAt: string;
    }
  | {
      source: "supabase";
      fileName: string;
      storagePath: string;
      sizeBytes: number | null;
      updatedAt: string | null;
    };

function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getDocumentTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, "");
}

function buildAvailableDocuments(records: ResolvedDocumentRecord[]): AvailableDocument[] {
  const counts = new Map<string, number>();

  return records.map((record) => {
    const title = getDocumentTitle(record.fileName);
    const baseSlug = createSlug(title);
    const nextCount = (counts.get(baseSlug) ?? 0) + 1;

    counts.set(baseSlug, nextCount);

    return {
      slug: nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`,
      title,
      fileName: record.fileName,
      storagePath: record.source === "supabase" ? record.storagePath : record.fileName,
      sizeBytes: record.sizeBytes,
      source: record.source,
      updatedAt: record.updatedAt,
    } satisfies AvailableDocument;
  });
}

function getLocalDocumentDirectories() {
  const configuredDirectory = process.env.DOCUMENTS_DIR?.trim();
  const homeDirectory = process.env.HOME?.trim();

  return [
    configuredDirectory,
    homeDirectory ? path.join(homeDirectory, "Downloads", "Wichtige Dokumente") : null,
    path.join(/* turbopackIgnore: true */ process.cwd(), "private-documents"),
  ].filter((value): value is string => Boolean(value));
}

async function listLocalDocuments(): Promise<LocalDocumentRecord[]> {
  const documents = new Map<string, LocalDocumentRecord>();

  for (const directory of getLocalDocumentDirectories()) {
    let entries: { isFile(): boolean; name: string }[];

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      if (documents.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(directory, entry.name);
      const metadata = await stat(absolutePath);

      documents.set(entry.name, {
        absolutePath,
        fileName: entry.name,
        sizeBytes: metadata.size,
        updatedAt: metadata.mtime.toISOString(),
      });
    }
  }

  return Array.from(documents.values()).sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function getSupabaseDocumentConfig() {
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET?.trim();

  if (!bucket || !isSupabaseConfigured()) {
    return null;
  }

  const normalizedPrefix = process.env.SUPABASE_DOCUMENTS_PREFIX?.trim().replace(/^\/+|\/+$/g, "");

  return {
    bucket,
    prefix: normalizedPrefix ? normalizedPrefix : "",
  };
}

function getSupabaseStoragePath(fileName: string, prefix: string) {
  return prefix ? `${prefix}/${fileName}` : fileName;
}

async function listSupabaseDocuments() {
  const config = getSupabaseDocumentConfig();

  if (!config) {
    return [] satisfies ResolvedDocumentRecord[];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage.from(config.bucket).list(config.prefix || undefined, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(`Unable to list documents from Supabase storage: ${error.message}`);
  }

  return (data ?? [])
    .filter((item) => item.name && item.name.toLowerCase().endsWith(".pdf"))
    .map((item) => {
      const size =
        typeof item.metadata === "object" &&
        item.metadata !== null &&
        "size" in item.metadata &&
        typeof item.metadata.size === "number"
          ? item.metadata.size
          : null;

      return {
        source: "supabase",
        fileName: item.name,
        storagePath: getSupabaseStoragePath(item.name, config.prefix),
        sizeBytes: size,
        updatedAt: item.updated_at ?? null,
      } satisfies ResolvedDocumentRecord;
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

async function listResolvedDocuments() {
  const localDocuments = await listLocalDocuments();
  const localNames = new Set(localDocuments.map((document) => document.fileName));
  const supabaseDocuments = (await listSupabaseDocuments()).filter(
    (document) => !localNames.has(document.fileName),
  );

  return [
    ...localDocuments.map((document) => ({
      source: "local",
      fileName: document.fileName,
      absolutePath: document.absolutePath,
      sizeBytes: document.sizeBytes,
      updatedAt: document.updatedAt,
    }) satisfies ResolvedDocumentRecord),
    ...supabaseDocuments,
  ].sort((left, right) => left.fileName.localeCompare(right.fileName));
}

async function getResolvedDocumentBySlug(slug: string) {
  const records = await listResolvedDocuments();
  const availableDocuments = buildAvailableDocuments(records);
  const matchedDocument = availableDocuments.find((document) => document.slug === slug);

  if (!matchedDocument) {
    return null;
  }

  const matchedRecord = records.find(
    (record) =>
      record.fileName === matchedDocument.fileName &&
      (record.source === matchedDocument.source ||
        (record.source === "supabase" && matchedDocument.source === "supabase")),
  );

  if (!matchedRecord) {
    return null;
  }

  return {
    document: matchedDocument,
    record: matchedRecord,
  };
}

function sanitizeUploadedFileName(value: string) {
  const normalized = value.replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim();
  const safeName = normalized.replace(/[^a-zA-Z0-9().,'+ _-]/g, "");

  if (!safeName) {
    return "document.pdf";
  }

  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

async function pathExists(absolutePath: string) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export function getDocumentsUploadDirectory() {
  const configuredUploadDirectory = process.env.DOCUMENTS_UPLOAD_DIR?.trim();
  const configuredDirectory = process.env.DOCUMENTS_DIR?.trim();

  return (
    configuredUploadDirectory ||
    configuredDirectory ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "private-documents")
  );
}

async function getUniqueUploadedFileName(originalFileName: string) {
  const sanitizedFileName = sanitizeUploadedFileName(originalFileName);
  const parsed = path.parse(sanitizedFileName);
  const existingNames = new Set((await listLocalDocuments()).map((document) => document.fileName.toLowerCase()));

  if (!existingNames.has(sanitizedFileName.toLowerCase())) {
    return sanitizedFileName;
  }

  let counter = 2;

  while (true) {
    const nextName = `${parsed.name} (${counter})${parsed.ext || ".pdf"}`;

    if (!existingNames.has(nextName.toLowerCase())) {
      return nextName;
    }

    counter += 1;
  }
}

export async function saveUploadedDocument(file: File) {
  const fileName = sanitizeUploadedFileName(file.name || "document.pdf");

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are supported.");
  }

  if (file.size <= 0) {
    throw new Error("The selected file is empty.");
  }

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("The PDF is too large. Please keep it under 50 MB.");
  }

  const uploadDirectory = getDocumentsUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const uniqueFileName = await getUniqueUploadedFileName(fileName);
  const absolutePath = path.join(uploadDirectory, uniqueFileName);

  if (await pathExists(absolutePath)) {
    throw new Error("A file with that name already exists.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  const documents = await listAvailableDocuments();
  const uploadedDocument = documents.find((document) => document.fileName === uniqueFileName && document.source === "local");

  if (!uploadedDocument) {
    throw new Error("The PDF was uploaded, but it could not be indexed afterwards.");
  }

  return uploadedDocument;
}

export async function listAvailableDocuments(): Promise<AvailableDocument[]> {
  return buildAvailableDocuments(await listResolvedDocuments());
}

export async function getAvailableDocumentBySlug(slug: string): Promise<AvailableDocument | null> {
  const matched = await getResolvedDocumentBySlug(slug);
  return matched?.document ?? null;
}

export async function getDocumentPayload(slug: string) {
  const matched = await getResolvedDocumentBySlug(slug);

  if (!matched) {
    return null;
  }

  if (matched.record.source === "local") {
    const file = await readFile(matched.record.absolutePath);

    return {
      bytes: file,
      document: matched.document,
    };
  }

  const config = getSupabaseDocumentConfig();

  if (!config) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage.from(config.bucket).download(matched.record.storagePath);

  if (error) {
    if (error.message.toLowerCase().includes("not found")) {
      return null;
    }

    throw new Error(`Unable to download document from Supabase storage: ${error.message}`);
  }

  const bytes = Buffer.from(await data.arrayBuffer());

  return {
    bytes,
    document: matched.document,
  };
}
