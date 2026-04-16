import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export const salesMachineTables = {
  leads: "sales_machine_leads",
  leadCrmMetadata: "sales_machine_lead_crm_metadata",
  contacts: "sales_machine_contacts",
  runs: "sales_machine_runs",
  searchJobs: "sales_machine_search_jobs",
  enrichmentJobs: "sales_machine_enrichment_jobs",
  serviceProfiles: "sales_machine_service_profiles",
  auditJobs: "sales_machine_website_audit_jobs",
  auditFindings: "sales_machine_website_audit_findings",
  prospectVariables: "sales_machine_prospect_variables",
  sequenceTemplates: "sales_machine_sequence_templates",
  campaigns: "sales_machine_campaigns",
  campaignSteps: "sales_machine_campaign_steps",
  campaignLeads: "sales_machine_campaign_leads",
  generatedSequences: "sales_machine_generated_sequences",
  connectedMailboxes: "sales_machine_connected_mailboxes",
  emailThreads: "sales_machine_email_threads",
  emailMessages: "sales_machine_email_messages",
  outreachStates: "sales_machine_outreach_states",
  suppressionEntries: "sales_machine_suppression_entries",
  opportunities: "sales_machine_opportunities",
  meetings: "sales_machine_meetings",
  proposalTemplates: "sales_machine_proposal_templates",
  proposalDocuments: "sales_machine_proposal_documents",
  clients: "sales_machine_clients",
  clientProjects: "sales_machine_client_projects",
  projectTasks: "sales_machine_project_tasks",
  clientAssets: "sales_machine_client_assets",
  clientAssetRequests: "sales_machine_client_asset_requests",
  reminders: "sales_machine_reminders",
  activityNotes: "sales_machine_activity_notes",
  serviceOfferProfiles: "sales_machine_service_offer_profiles",
  reportingConnections: "sales_machine_reporting_connections",
  monthlyReports: "sales_machine_monthly_reports",
  trashEntries: "sales_machine_trash_entries",
} as const;

let cachedClient: SupabaseClient | null = null;
let cachedKey: string | null = null;

export function isSupabaseConfigured() {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function getSupabaseAdminClient() {
  const env = getEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use database storage.",
    );
  }

  const cacheKey = `${env.supabaseUrl}:${env.supabaseServiceRoleKey}`;

  if (!cachedClient || cachedKey !== cacheKey) {
    cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedKey = cacheKey;
  }

  return cachedClient;
}

export async function probeSupabaseTable(tableName: string) {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      exists: false,
      error: "Supabase is not configured.",
    };
  }

  const client = getSupabaseAdminClient();
  const result = await client.from(tableName).select("id", { head: true, count: "exact" });

  if (!result.error) {
    return {
      configured: true,
      exists: true,
      error: null,
    };
  }

  const message = result.error.message ?? "Unknown Supabase error.";
  const missingFromSchemaCache =
    result.error.code === "PGRST205" ||
    message.toLowerCase().includes("schema cache") ||
    message.toLowerCase().includes("could not find the table");

  return {
    configured: true,
    exists: !missingFromSchemaCache,
    error: message,
  };
}
