#!/usr/bin/env node
/**
 * Migrates all data from old Supabase project to new Supabase project.
 *
 * Usage:
 *   node scripts/migrate-supabase.mjs
 *
 * Prerequisites: Apply supabase/schema.sql to the new project first via SQL Editor.
 */

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "sales_machine_leads",
  "sales_machine_lead_crm_metadata",
  "sales_machine_contacts",
  "sales_machine_runs",
  "sales_machine_search_jobs",
  "sales_machine_enrichment_jobs",
  "sales_machine_service_profiles",
  "sales_machine_website_audit_jobs",
  "sales_machine_website_audit_findings",
  "sales_machine_prospect_variables",
  "sales_machine_sequence_templates",
  "sales_machine_campaigns",
  "sales_machine_campaign_steps",
  "sales_machine_campaign_leads",
  "sales_machine_generated_sequences",
  "sales_machine_connected_mailboxes",
  "sales_machine_email_threads",
  "sales_machine_email_messages",
  "sales_machine_outreach_states",
  "sales_machine_suppression_entries",
  "sales_machine_opportunities",
  "sales_machine_meetings",
  "sales_machine_proposal_templates",
  "sales_machine_proposal_documents",
  "sales_machine_clients",
  "sales_machine_client_projects",
  "sales_machine_project_tasks",
  "sales_machine_client_assets",
  "sales_machine_client_asset_requests",
  "sales_machine_reminders",
  "sales_machine_activity_notes",
  "sales_machine_service_offer_profiles",
  "sales_machine_reporting_connections",
  "sales_machine_monthly_reports",
];

async function fetchAll(baseUrl, key, table) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${baseUrl}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${from}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GET ${table} failed [${res.status}]: ${body}`);
    }

    const page = await res.json();

    if (!Array.isArray(page)) {
      throw new Error(`Unexpected response for ${table}: ${JSON.stringify(page)}`);
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function upsertAll(baseUrl, key, table, rows) {
  if (rows.length === 0) return;

  const chunkSize = 200;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const url = `${baseUrl}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`INSERT ${table} [chunk ${i / chunkSize + 1}] failed [${res.status}]: ${body}`);
    }
  }
}

async function main() {
  if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
    console.error(
      [
        "Missing required env vars.",
        "Set OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, and NEW_SUPABASE_SERVICE_ROLE_KEY before running this script.",
      ].join(" "),
    );
    process.exit(1);
  }

  console.log("Starting Supabase migration...\n");
  console.log(`Source: ${OLD_URL}`);
  console.log(`Target: ${NEW_URL}\n`);

  let totalRows = 0;
  const errors = [];

  for (const table of TABLES) {
    try {
      process.stdout.write(`  ${table}... `);
      const rows = await fetchAll(OLD_URL, OLD_KEY, table);
      process.stdout.write(`read ${rows.length} rows`);

      if (rows.length > 0) {
        await upsertAll(NEW_URL, NEW_KEY, table, rows);
        process.stdout.write(` → inserted ✓\n`);
        totalRows += rows.length;
      } else {
        process.stdout.write(` (empty, skipped)\n`);
      }
    } catch (err) {
      process.stdout.write(` ✗ ERROR\n`);
      errors.push({ table, message: err.message });
    }
  }

  console.log(`\nMigration complete. ${totalRows} total rows migrated.`);

  if (errors.length > 0) {
    console.error(`\n⚠ ${errors.length} error(s):`);
    for (const { table, message } of errors) {
      console.error(`  ${table}: ${message}`);
    }
    process.exit(1);
  } else {
    console.log("✓ No errors.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
