# N8N Migration Notes

This project intentionally does not recreate n8n node-for-node.

Instead, it breaks the old flows into product-shaped parts:

## Modules

- `google-places.ts`
  Handles location geocoding and Google Places pagination.
- `openai-enrichment.ts`
  Handles contact discovery with OpenAI web search and strict JSON output.
- `workflows.ts`
  Orchestrates full runs, step logs, failure handling, and persistence.
- `store.ts`
  Persists app state so the UI can show leads, contacts, and run history.

## Why this is better than staying in n8n

- Logic is testable and reusable.
- Errors have context and history.
- The UI can show real lead state, not just success or failure emails.
- New features like outreach drafts, CRM sync, scoring, and scheduling fit naturally on top.
