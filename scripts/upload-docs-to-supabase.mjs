#!/usr/bin/env node
/**
 * Uploads all PDFs from ~/Downloads/Wichtige Dokumente to Supabase Storage bucket "documents".
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || "documents";
const DOCS_DIR =
  process.env.DOCUMENTS_SOURCE_DIR || path.join(homedir(), "Downloads", "Wichtige Dokumente");

async function uploadFile(fileName, bytes) {
  // Supabase Storage doesn't allow apostrophes in object keys
  const encodedName = encodeURIComponent(fileName.replace(/'/g, ""));
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed [${res.status}]: ${body}`);
  }

  return res.json();
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Export both before running this script.",
    );
    process.exit(1);
  }

  const entries = await readdir(DOCS_DIR);
  const pdfs = entries.filter((f) => f.toLowerCase().endsWith(".pdf"));

  console.log(`Found ${pdfs.length} PDFs in ${DOCS_DIR}\n`);

  let ok = 0;
  let failed = 0;

  for (const pdf of pdfs) {
    process.stdout.write(`  ${pdf}... `);
    try {
      const bytes = await readFile(path.join(DOCS_DIR, pdf));
      await uploadFile(pdf, bytes);
      process.stdout.write("✓\n");
      ok++;
    } catch (err) {
      process.stdout.write(`✗ ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} uploaded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
