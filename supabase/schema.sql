create table if not exists public.sales_machine_runs (
  id text primary key,
  kind text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  input jsonb not null default '{}'::jsonb,
  summary text,
  error text,
  started_at timestamptz not null,
  finished_at timestamptz,
  steps jsonb not null default '[]'::jsonb
);

alter table public.sales_machine_runs
  drop constraint if exists sales_machine_runs_kind_check;

alter table public.sales_machine_runs
  add constraint sales_machine_runs_kind_check
  check (
    kind in (
      'lead-search',
      'contact-enrichment',
      'website-audit',
      'sequence-generation',
      'message-send',
      'inbox-sync'
    )
  );

create table if not exists public.sales_machine_search_jobs (
  id text primary key,
  run_id text not null,
  niche text not null,
  location_label text not null,
  radius_meters integer not null,
  target_max_leads integer not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  next_page_token text,
  pages_fetched integer not null default 0,
  leads_collected integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  finished_at timestamptz
);

create table if not exists public.sales_machine_enrichment_jobs (
  id text primary key,
  run_id text not null,
  batch_size integer not null,
  provider_order jsonb not null default '[]'::jsonb,
  status text not null check (status in ('running', 'completed', 'failed')),
  leads_claimed integer not null default 0,
  leads_processed integer not null default 0,
  enriched_count integer not null default 0,
  missing_count integer not null default 0,
  failed_count integer not null default 0,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  finished_at timestamptz
);

create table if not exists public.sales_machine_leads (
  id text primary key,
  company_name text not null,
  address text not null,
  website_uri text,
  rating double precision,
  national_phone_number text,
  international_phone_number text,
  latitude double precision,
  longitude double precision,
  niche text not null,
  location_label text not null,
  source text not null check (source in ('google-places', 'manual-entry', 'csv-import')),
  stage text not null check (stage in ('discovered', 'enriched', 'contact_missing', 'error')),
  person_searched boolean not null default false,
  contact_count integer not null default 0,
  research_summary text,
  last_error text,
  last_run_id text,
  discovered_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_lead_crm_metadata (
  id text primary key,
  lead_id text not null,
  notes text,
  priority text not null check (priority in ('low', 'medium', 'high')),
  next_action text check (
    next_action in ('review_audit', 'approve_sequence', 'send_now', 'reply', 'book_meeting', 'follow_up_later')
  ),
  next_action_due_at timestamptz,
  owner_label text,
  archived_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_contacts (
  id text primary key,
  lead_id text not null,
  name text not null,
  title text,
  email text,
  linkedin text,
  instagram text,
  twitter text,
  facebook text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  source text not null check (source in ('openai-web-search', 'manual-entry', 'csv-import')),
  discovered_at timestamptz not null
);

create table if not exists public.sales_machine_service_profiles (
  id text primary key,
  service_key text not null unique check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  label text not null,
  short_description text not null,
  audit_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_website_audit_jobs (
  id text primary key,
  run_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  scope text not null check (scope in ('run', 'sheet', 'all')),
  source_run_id text,
  sheet_key text,
  batch_size integer not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  leads_claimed integer not null default 0,
  leads_processed integer not null default 0,
  findings_created integer not null default 0,
  failed_count integer not null default 0,
  current_lead_id text,
  current_lead_name text,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  finished_at timestamptz
);

create table if not exists public.sales_machine_website_audit_findings (
  id text primary key,
  lead_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  job_id text not null,
  issue_type text not null,
  page_url text,
  page_label text,
  summary text not null,
  recognizable_reason text not null,
  consequence_mechanics text not null,
  review_time text not null,
  micro_yes text not null,
  preview_asset_exists boolean not null default false,
  evidence jsonb not null default '[]'::jsonb,
  raw_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_prospect_variables (
  id text primary key,
  lead_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  finding_id text not null,
  contact_id text,
  variables jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_sequence_templates (
  id text primary key,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  step_number integer not null check (step_number between 1 and 4),
  day_offset integer not null,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_campaigns (
  id text primary key,
  name text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  status text not null check (status in ('draft', 'active', 'paused', 'completed')),
  source_scope text not null check (source_scope in ('run', 'sheet', 'all')),
  source_run_id text,
  sheet_key text,
  mailbox_id text,
  timezone text not null,
  send_window_start text not null,
  send_window_end text not null,
  allowed_weekdays jsonb not null default '[1,2,3,4,5]'::jsonb,
  stop_on_reply boolean not null default true,
  wait_hours_after_final_step integer not null default 72,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_campaign_steps (
  id text primary key,
  campaign_id text not null,
  step_number integer not null check (step_number between 1 and 4),
  day_offset integer not null,
  subject_template text not null,
  body_template text not null,
  enabled boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_campaign_leads (
  id text primary key,
  campaign_id text not null,
  lead_id text not null,
  contact_id text,
  finding_id text,
  variables_id text,
  sequence_id text,
  outreach_state_id text,
  status text not null check (
    status in ('audited', 'drafted', 'approved', 'scheduled', 'sent', 'replied', 'booked', 'nurture', 'closed', 'needs_escalation', 'no_show')
  ),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_generated_sequences (
  id text primary key,
  campaign_id text,
  lead_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  finding_id text not null,
  variables_id text not null,
  mailbox_id text,
  state text not null check (
    state in ('drafted', 'approved', 'scheduled', 'sent', 'replied', 'booked', 'nurture', 'closed', 'needs_escalation', 'no_show')
  ),
  steps jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  approved_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_connected_mailboxes (
  id text primary key,
  provider text not null check (provider in ('gmail')),
  email text not null,
  display_name text,
  status text not null check (status in ('setup_needed', 'connected', 'error')),
  signature text,
  daily_limit integer,
  oauth_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_email_threads (
  id text primary key,
  campaign_id text,
  mailbox_id text not null,
  lead_id text,
  service_key text check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  sequence_id text,
  external_thread_id text,
  subject text not null,
  snippet text,
  contact_name text,
  contact_email text,
  state text not null check (
    state in ('drafted', 'approved', 'scheduled', 'sent', 'replied', 'booked', 'nurture', 'closed', 'needs_escalation', 'no_show')
  ),
  last_message_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_email_messages (
  id text primary key,
  thread_id text not null,
  mailbox_id text not null,
  external_message_id text,
  direction text not null check (direction in ('outbound', 'inbound')),
  status text not null check (status in ('draft', 'sent', 'received', 'failed')),
  subject text not null,
  body_text text not null,
  from_address text,
  to_address text,
  sent_at timestamptz,
  created_at timestamptz not null
);

create table if not exists public.sales_machine_outreach_states (
  id text primary key,
  campaign_id text,
  lead_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  mailbox_id text,
  sequence_id text,
  thread_id text,
  state text not null check (
    state in ('drafted', 'approved', 'scheduled', 'sent', 'replied', 'booked', 'nurture', 'closed', 'needs_escalation', 'no_show')
  ),
  next_step_number integer,
  notes text,
  last_activity_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_suppression_entries (
  id text primary key,
  email text,
  domain text,
  reason text not null,
  source text not null check (source in ('manual', 'bounce', 'reply', 'system')),
  created_at timestamptz not null
);

create table if not exists public.sales_machine_opportunities (
  id text primary key,
  lead_id text not null,
  contact_id text,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  source_campaign_id text,
  stage text not null check (
    stage in ('new', 'qualified', 'meeting_booked', 'proposal_drafted', 'proposal_sent', 'won', 'lost', 'nurture')
  ),
  status text not null check (status in ('open', 'won', 'lost', 'nurture')),
  estimated_value_usd double precision,
  close_probability double precision,
  next_step text,
  next_step_due_at timestamptz,
  last_touch_at timestamptz not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_meetings (
  id text primary key,
  opportunity_id text,
  lead_id text not null,
  contact_id text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  agenda text,
  prep_notes text,
  outcome text,
  follow_up_due_at timestamptz,
  status text not null check (status in ('planned', 'completed', 'no_show', 'cancelled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_proposal_templates (
  id text primary key,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  title_template text not null,
  body_template text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_proposal_documents (
  id text primary key,
  opportunity_id text not null,
  lead_id text not null,
  contact_id text,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  status text not null check (status in ('draft', 'sent', 'accepted', 'lost')),
  title text not null,
  amount_usd double precision,
  content text not null,
  doc_url text,
  pdf_url text,
  sent_at timestamptz,
  accepted_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_clients (
  id text primary key,
  lead_id text not null,
  primary_contact_id text,
  source_opportunity_id text,
  status text not null check (status in ('active', 'paused', 'completed')),
  start_date timestamptz,
  retainer_type text not null check (retainer_type in ('one_off', 'monthly', 'quarterly', 'project')),
  billing_cycle text,
  notes text,
  drive_folder_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_client_projects (
  id text primary key,
  client_id text not null,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  name text not null,
  status text not null check (status in ('planned', 'active', 'blocked', 'completed')),
  start_date timestamptz,
  target_date timestamptz,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_project_tasks (
  id text primary key,
  project_id text not null,
  title text not null,
  status text not null check (status in ('todo', 'in_progress', 'done')),
  due_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_client_assets (
  id text primary key,
  client_id text not null,
  label text not null,
  kind text not null,
  drive_url text,
  status text not null check (status in ('expected', 'uploaded', 'approved')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_client_asset_requests (
  id text primary key,
  client_id text not null,
  type text not null,
  status text not null check (status in ('requested', 'received', 'cancelled')),
  description text,
  requested_at timestamptz not null,
  received_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_reminders (
  id text primary key,
  lead_id text,
  opportunity_id text,
  client_id text,
  project_id text,
  title text not null,
  due_at timestamptz not null,
  status text not null check (status in ('open', 'done', 'snoozed')),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_activity_notes (
  id text primary key,
  entity_type text not null check (entity_type in ('lead', 'opportunity', 'client', 'project')),
  entity_id text not null,
  lead_id text,
  client_id text,
  body text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_service_offer_profiles (
  id text primary key,
  service_key text not null check (
    service_key in ('seo', 'webdesign', 'copywriting', 'ai_automation', 'marketing', 'lead_capture')
  ),
  label text not null,
  scope_defaults text not null,
  pricing_notes text,
  objection_notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_reporting_connections (
  id text primary key,
  client_id text not null,
  kind text not null check (kind in ('search_console', 'ga4', 'pagespeed')),
  target text not null,
  status text not null check (status in ('setup_needed', 'connected', 'error')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.sales_machine_monthly_reports (
  id text primary key,
  client_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null check (status in ('draft', 'ready', 'sent')),
  title text not null,
  summary text not null,
  content text not null,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  doc_url text,
  generated_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.sales_machine_website_audit_jobs
  add column if not exists campaign_id text;

alter table public.sales_machine_generated_sequences
  add column if not exists campaign_id text;

alter table public.sales_machine_email_threads
  add column if not exists campaign_id text;

alter table public.sales_machine_outreach_states
  add column if not exists campaign_id text;

create index if not exists sales_machine_runs_started_at_idx
  on public.sales_machine_runs (started_at desc);

create index if not exists sales_machine_search_jobs_run_id_idx
  on public.sales_machine_search_jobs (run_id);

create index if not exists sales_machine_enrichment_jobs_run_id_idx
  on public.sales_machine_enrichment_jobs (run_id);

create index if not exists sales_machine_leads_updated_at_idx
  on public.sales_machine_leads (updated_at desc);

create index if not exists sales_machine_lead_crm_metadata_lead_id_idx
  on public.sales_machine_lead_crm_metadata (lead_id, updated_at desc);

create index if not exists sales_machine_leads_stage_idx
  on public.sales_machine_leads (stage, person_searched, updated_at);

create index if not exists sales_machine_contacts_lead_id_idx
  on public.sales_machine_contacts (lead_id, discovered_at desc);

create index if not exists sales_machine_service_profiles_service_key_idx
  on public.sales_machine_service_profiles (service_key);

create index if not exists sales_machine_website_audit_jobs_run_id_idx
  on public.sales_machine_website_audit_jobs (run_id, service_key, created_at desc);

create index if not exists sales_machine_website_audit_findings_lead_id_idx
  on public.sales_machine_website_audit_findings (lead_id, service_key, updated_at desc);

create index if not exists sales_machine_prospect_variables_lead_id_idx
  on public.sales_machine_prospect_variables (lead_id, service_key, updated_at desc);

create index if not exists sales_machine_sequence_templates_service_key_idx
  on public.sales_machine_sequence_templates (service_key, step_number);

create index if not exists sales_machine_campaigns_service_key_idx
  on public.sales_machine_campaigns (service_key, status, updated_at desc);

create index if not exists sales_machine_campaign_steps_campaign_id_idx
  on public.sales_machine_campaign_steps (campaign_id, step_number);

create index if not exists sales_machine_campaign_leads_campaign_id_idx
  on public.sales_machine_campaign_leads (campaign_id, updated_at desc);

create index if not exists sales_machine_generated_sequences_lead_id_idx
  on public.sales_machine_generated_sequences (lead_id, service_key, updated_at desc);

create index if not exists sales_machine_connected_mailboxes_email_idx
  on public.sales_machine_connected_mailboxes (email);

create index if not exists sales_machine_email_threads_mailbox_id_idx
  on public.sales_machine_email_threads (mailbox_id, last_message_at desc);

create index if not exists sales_machine_email_messages_thread_id_idx
  on public.sales_machine_email_messages (thread_id, created_at desc);

create index if not exists sales_machine_outreach_states_lead_id_idx
  on public.sales_machine_outreach_states (lead_id, service_key, updated_at desc);

create index if not exists sales_machine_suppression_entries_email_idx
  on public.sales_machine_suppression_entries (email, domain);

create index if not exists sales_machine_opportunities_lead_id_idx
  on public.sales_machine_opportunities (lead_id, updated_at desc);

create index if not exists sales_machine_meetings_lead_id_idx
  on public.sales_machine_meetings (lead_id, scheduled_at desc);

create index if not exists sales_machine_proposal_templates_service_key_idx
  on public.sales_machine_proposal_templates (service_key);

create index if not exists sales_machine_proposal_documents_opportunity_id_idx
  on public.sales_machine_proposal_documents (opportunity_id, updated_at desc);

create index if not exists sales_machine_clients_lead_id_idx
  on public.sales_machine_clients (lead_id, updated_at desc);

create index if not exists sales_machine_client_projects_client_id_idx
  on public.sales_machine_client_projects (client_id, updated_at desc);

create index if not exists sales_machine_project_tasks_project_id_idx
  on public.sales_machine_project_tasks (project_id, sort_order);

create index if not exists sales_machine_client_assets_client_id_idx
  on public.sales_machine_client_assets (client_id, updated_at desc);

create index if not exists sales_machine_client_asset_requests_client_id_idx
  on public.sales_machine_client_asset_requests (client_id, updated_at desc);

create index if not exists sales_machine_reminders_due_at_idx
  on public.sales_machine_reminders (due_at, status);

create index if not exists sales_machine_activity_notes_entity_idx
  on public.sales_machine_activity_notes (entity_type, entity_id, updated_at desc);

create index if not exists sales_machine_service_offer_profiles_service_key_idx
  on public.sales_machine_service_offer_profiles (service_key);

create index if not exists sales_machine_reporting_connections_client_id_idx
  on public.sales_machine_reporting_connections (client_id, updated_at desc);

create index if not exists sales_machine_monthly_reports_client_id_idx
  on public.sales_machine_monthly_reports (client_id, generated_at desc);
