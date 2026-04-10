#!/usr/bin/env node
/**
 * Updates .env.local to point to the new Supabase project.
 * Run after migrate-supabase.mjs completes successfully.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!NEW_URL || !NEW_KEY) {
    console.error(
      "Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY. Export both before running this script.",
    );
    process.exit(1);
  }

  const raw = await readFile(envPath, "utf8");

  let updated = raw
    .replace(/^SUPABASE_URL=.*/m, `SUPABASE_URL=${NEW_URL}`)
    .replace(/^SUPABASE_SERVICE_ROLE_KEY=.*/m, `SUPABASE_SERVICE_ROLE_KEY=${NEW_KEY}`);

  if (updated === raw) {
    console.error("No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY lines found in .env.local — check manually.");
    process.exit(1);
  }

  await writeFile(envPath, updated, "utf8");
  console.log(".env.local updated to new Supabase project.");
  console.log(`  SUPABASE_URL=${NEW_URL}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY=${NEW_KEY}`);
  console.log("\nDon't forget to update Vercel env vars too:");
  console.log("  vercel env rm SUPABASE_URL production && vercel env add SUPABASE_URL production");
  console.log("  vercel env rm SUPABASE_SERVICE_ROLE_KEY production && vercel env add SUPABASE_SERVICE_ROLE_KEY production");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
