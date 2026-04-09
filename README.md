# Fieldflow

Fieldflow is a small sales-outreach machine that replaces the three n8n workflows you shared with an app that has real state, visible run logs, and a cleaner place to grow into outreach software.

## What it does now

- Searches Google Places for a niche in a location and saves leads locally.
- Enriches pending leads with OpenAI web research and can fall back to Gemini search when needed.
- Runs service-specific website audits and saves one chosen issue plus reusable outreach variables.
- Generates a fixed written-first 4-step email cadence per lead and service.
- Adds a Gmail-ready outreach surface with mailbox connection, thread sync, reply, and state tracking.
- Stores leads, contacts, workflow runs, and durable search/enrichment jobs in local JSON or Supabase.
- Exposes both UI forms and JSON endpoints so a scheduler or external worker can trigger runs later.

## The n8n migration map

- `My workflow.json` -> `runLeadSearch()`
  Pulls Google Maps/Places results, handles next-page tokens, and upserts leads.
- `My workflow 2.json` -> `runContactEnrichment()`
  Selects pending leads, runs AI research, saves contacts, and marks leads as processed.
- `Open Ai API Agent.json` -> `enrichLeadWithOpenAi()`
  Uses the OpenAI Responses API with built-in web search instead of an n8n AI node.
- Gemini fallback -> `enrichLeadWithFallback()`
  Tries OpenAI first, then hands off to Gemini when OpenAI fails or returns weak research.

## Environment

Create `.env.local` from `.env.example` and fill in:

- `GOOGLE_MAPS_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_ADMIN_KEY`
- `OPENAI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`
- `GCP_BIGQUERY_SERVICE_ACCOUNT_JSON`
- `GCP_BILLING_EXPORT_PROJECT_ID`
- `GCP_BILLING_EXPORT_DATASET`
- `GCP_BILLING_EXPORT_TABLE`
- `GCP_TRIAL_START_DATE`
- `GCP_TRIAL_LENGTH_DAYS`
- `GCP_TRIAL_TOTAL_CREDIT_USD`

Recommended default model: `gpt-5-mini`
Recommended Gemini fallback model: `gemini-2.5-flash`

If the two Supabase env vars are blank, the app falls back to `.data/sales-machine.json`.

`GCP_BIGQUERY_SERVICE_ACCOUNT_JSON` should be a single-line JSON string for a service account that can read your billing export dataset. If the `private_key` contains newlines, keep them escaped as `\n`.

For hosted environments like Bolt, do not use a local file path such as `/Users/.../service-account.json`. Paste the JSON itself into the environment variable.

## Bolt deployment

If you deploy this app to Bolt, set the environment variables in Bolt's environment/secrets UI instead of committing a `.env` file into the repo.

Recommended hosted values:

- `NEXT_PUBLIC_APP_URL=https://john123-05-automatio-ffon.bolt.host`
- `GOOGLE_OAUTH_REDIRECT_URI=https://john123-05-automatio-ffon.bolt.host/api/mailboxes/google/callback`
- `APP_ACCESS_PASSWORD=<your-login-password>`
- `SCHEDULER_SECRET=<long-random-secret>`

Important hosted notes:

- Bolt will not be able to read files from your Mac such as `~/Downloads/Wichtige Dokumente`.
- For documents on Bolt, use uploads inside the app or a private Supabase storage bucket.
- The Telegram webhook URL should be `https://john123-05-automatio-ffon.bolt.host/api/telegram/webhook`
- If you only want the app to start first, you can leave `GCP_BIGQUERY_SERVICE_ACCOUNT_JSON` blank and use the manual billing fallback fields until BigQuery is configured correctly.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy the project URL into `SUPABASE_URL`.
4. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

After that, the app will switch from local file storage to Supabase automatically.

## Billing overview setup

The dashboard can also show a `Cost & Credits` section with Google Cloud and OpenAI spend.

1. Enable Cloud Billing export to BigQuery for the billing account you want to track.
2. Enable the BigQuery API in the Google Cloud project that hosts the export dataset.
3. Create a service account with read access to the export dataset and copy its JSON into `GCP_BIGQUERY_SERVICE_ACCOUNT_JSON`.
4. Set:
   - `GCP_BILLING_EXPORT_PROJECT_ID`
   - `GCP_BILLING_EXPORT_DATASET`
   - `GCP_BILLING_EXPORT_TABLE`
5. Add your Google trial metadata:
   - `GCP_TRIAL_START_DATE` in `YYYY-MM-DD`
   - `GCP_TRIAL_LENGTH_DAYS` (defaults to `90`)
   - `GCP_TRIAL_TOTAL_CREDIT_USD`
6. Add `OPENAI_ADMIN_KEY` for exact organization-level OpenAI costs.

The Google trial card is derived from your configured start date and total credit. Google does not expose the console-style days-left metric directly, so the app computes it from your metadata and billing export totals.

## Why this matters

- The Google Places search now has a durable search job that stores `nextPageToken`, page count, and collected lead count while a run is in flight.
- Contact enrichment now has its own durable job record with claimed batch size and processed/enriched/missing/failed counters.
- The enrichment layer can now fall back from OpenAI to Gemini before the run gives up on a lead.
- This preserves the useful state-machine behavior from n8n without depending on Sheets or the n8n internal data table.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## API routes

You can trigger the workflows outside the UI too:

```bash
curl -X POST http://localhost:3000/api/leads/search \
  -H "Content-Type: application/json" \
  -d '{"niche":"restaurants","location":"London, UK","radiusMeters":1500,"maxLeads":20,"searchMode":"capped"}'
```

```bash
curl -X POST http://localhost:3000/api/leads/enrich \
  -H "Content-Type: application/json" \
  -d '{"batchSize":10,"includePreviouslyFailed":false,"scope":"run","sourceRunId":"run_123"}'
```

```bash
curl -X POST http://localhost:3000/api/audits/run \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"webdesign","scope":"run","sourceRunId":"run_123","batchSize":10}'
```

```bash
curl -X POST http://localhost:3000/api/sequences/generate \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"webdesign","scope":"run","sourceRunId":"run_123","onlyUnsequenced":true}'
```

## Where to take it next

- Add a background worker so the UI starts jobs and the worker drains them outside the request lifecycle.
- Add outreach drafts and sending states per contact.
- Add auth and workspace separation before multi-user use.
