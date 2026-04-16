import fs from "node:fs";
import path from "node:path";

export type SetupVaultKey =
  | "GOOGLE_MAPS_API_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_ADMIN_KEY"
  | "OPENAI_MODEL"
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "ANTHROPIC_API_KEY"
  | "CLAUDE_MODEL"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "GCP_BIGQUERY_SERVICE_ACCOUNT_JSON"
  | "GCP_BILLING_EXPORT_PROJECT_ID"
  | "GCP_BILLING_EXPORT_DATASET"
  | "GCP_BILLING_EXPORT_TABLE"
  | "GCP_TRIAL_START_DATE"
  | "GCP_TRIAL_TOTAL_CREDIT_USD"
  | "GCP_BILLING_MANUAL_CURRENCY"
  | "GCP_BILLING_MANUAL_MONTH_TO_DATE_COST"
  | "GCP_BILLING_MANUAL_SPEND_SINCE_TRIAL_START"
  | "GCP_BILLING_MANUAL_REMAINING_CREDIT"
  | "GOOGLE_OAUTH_CLIENT_ID"
  | "GOOGLE_OAUTH_CLIENT_SECRET"
  | "GOOGLE_OAUTH_REDIRECT_URI"
  | "NEXT_PUBLIC_APP_URL"
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_CHAT_ID";

export type SetupVaultSectionId =
  | "places"
  | "openai"
  | "gemini"
  | "anthropic"
  | "supabase"
  | "billing"
  | "gmail"
  | "telegram";

export type SetupVaultField = {
  key: SetupVaultKey;
  label: string;
  secret: boolean;
  multiline?: boolean;
  placeholder?: string;
};

export type SetupVaultSection = {
  id: SetupVaultSectionId;
  title: string;
  description: string;
  fields: SetupVaultField[];
};

export type SetupVaultSnapshot = Partial<Record<SetupVaultKey, string>>;

export type SetupVaultFieldState = SetupVaultField & {
  hasValue: boolean;
  preview: string;
};

export type SetupVaultSectionState = Omit<SetupVaultSection, "fields"> & {
  fields: SetupVaultFieldState[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const VAULT_PATH = path.join(DATA_DIR, "setup-vault.json");

export const setupVaultSections: SetupVaultSection[] = [
  {
    id: "places",
    title: "Google Places",
    description:
      "Lead search and Maps discovery. Replace this fast when one Google Cloud account is burned.",
    fields: [
      {
        key: "GOOGLE_MAPS_API_KEY",
        label: "Places / Maps API key",
        secret: true,
        placeholder: "AIza...",
      },
    ],
  },
  {
    id: "openai",
    title: "OpenAI",
    description:
      "Used for enrichment, web search, and admin-backed usage/billing checks.",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API key",
        secret: true,
        placeholder: "sk-...",
      },
      {
        key: "OPENAI_ADMIN_KEY",
        label: "OpenAI admin key",
        secret: true,
        placeholder: "sk-admin-...",
      },
      {
        key: "OPENAI_MODEL",
        label: "OpenAI model",
        secret: false,
        placeholder: "gpt-5-mini",
      },
    ],
  },
  {
    id: "gemini",
    title: "Gemini",
    description:
      "Used for fallback contact research and Gemini-powered app features.",
    fields: [
      {
        key: "GEMINI_API_KEY",
        label: "Gemini API key",
        secret: true,
        placeholder: "AIza...",
      },
      {
        key: "GEMINI_MODEL",
        label: "Gemini model",
        secret: false,
        placeholder: "gemini-2.5-flash",
      },
    ],
  },
  {
    id: "anthropic",
    title: "Anthropic (Claude)",
    description:
      "Last-resort fallback for contact enrichment. Claude Haiku is used by default.",
    fields: [
      {
        key: "ANTHROPIC_API_KEY",
        label: "Anthropic API key",
        secret: true,
        placeholder: "sk-ant-...",
      },
      {
        key: "CLAUDE_MODEL",
        label: "Claude model",
        secret: false,
        placeholder: "claude-haiku-4-5-20251001",
      },
    ],
  },
  {
    id: "supabase",
    title: "Supabase",
    description:
      "Storage and durable app data. Use the service role key only on the server.",
    fields: [
      {
        key: "SUPABASE_URL",
        label: "Supabase URL",
        secret: false,
        placeholder: "https://xxxx.supabase.co",
      },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase service role key",
        secret: true,
        placeholder: "eyJ...",
        multiline: true,
      },
    ],
  },
  {
    id: "billing",
    title: "Google Cloud billing",
    description:
      "BigQuery export and optional manual fallback values for Google Cloud cost tracking.",
    fields: [
      {
        key: "GCP_BIGQUERY_SERVICE_ACCOUNT_JSON",
        label: "BigQuery service account JSON",
        secret: true,
        multiline: true,
        placeholder: '{"type":"service_account",...}',
      },
      {
        key: "GCP_BILLING_EXPORT_PROJECT_ID",
        label: "Billing export project ID",
        secret: false,
        placeholder: "project-xxxx",
      },
      {
        key: "GCP_BILLING_EXPORT_DATASET",
        label: "Billing export dataset",
        secret: false,
        placeholder: "billing_export",
      },
      {
        key: "GCP_BILLING_EXPORT_TABLE",
        label: "Billing export table",
        secret: false,
        placeholder: "gcp_billing_export_v1_...",
      },
      {
        key: "GCP_TRIAL_START_DATE",
        label: "Trial start date",
        secret: false,
        placeholder: "2026-03-29",
      },
      {
        key: "GCP_TRIAL_TOTAL_CREDIT_USD",
        label: "Trial total credit",
        secret: false,
        placeholder: "300",
      },
      {
        key: "GCP_BILLING_MANUAL_CURRENCY",
        label: "Manual fallback currency",
        secret: false,
        placeholder: "EUR",
      },
      {
        key: "GCP_BILLING_MANUAL_MONTH_TO_DATE_COST",
        label: "Manual month-to-date cost",
        secret: false,
        placeholder: "1.91",
      },
      {
        key: "GCP_BILLING_MANUAL_SPEND_SINCE_TRIAL_START",
        label: "Manual spend since trial start",
        secret: false,
        placeholder: "1.91",
      },
      {
        key: "GCP_BILLING_MANUAL_REMAINING_CREDIT",
        label: "Manual remaining credit",
        secret: false,
        placeholder: "249.67",
      },
    ],
  },
  {
    id: "gmail",
    title: "Google OAuth / Gmail",
    description:
      "Required for mailbox connect, inbox sync, proposal/report Docs access, and Gmail sending.",
    fields: [
      {
        key: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        secret: true,
        placeholder: "xxxx.apps.googleusercontent.com",
      },
      {
        key: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        secret: true,
        placeholder: "GOCSPX-...",
      },
      {
        key: "GOOGLE_OAUTH_REDIRECT_URI",
        label: "Google OAuth redirect URI",
        secret: false,
        placeholder: "http://127.0.0.1:3000/api/mailboxes/google/callback",
      },
      {
        key: "NEXT_PUBLIC_APP_URL",
        label: "App URL",
        secret: false,
        placeholder: "http://127.0.0.1:3000",
      },
    ],
  },
  {
    id: "telegram",
    title: "Telegram alerts",
    description:
      "Send a Telegram message automatically when a new inbound email appears in the inbox sync.",
    fields: [
      {
        key: "TELEGRAM_BOT_TOKEN",
        label: "Telegram bot token",
        secret: true,
        placeholder: "123456:ABC-DEF...",
      },
      {
        key: "TELEGRAM_CHAT_ID",
        label: "Telegram chat ID",
        secret: false,
        placeholder: "123456789",
      },
    ],
  },
];

function ensureVaultDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readSetupVaultSync(): SetupVaultSnapshot {
  try {
    if (!fs.existsSync(VAULT_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(VAULT_PATH, "utf8").trim();

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as SetupVaultSnapshot;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function writeSetupVault(values: SetupVaultSnapshot) {
  ensureVaultDir();
  fs.writeFileSync(VAULT_PATH, JSON.stringify(values, null, 2));
}

export function updateSetupVault(nextValues: SetupVaultSnapshot) {
  const current = readSetupVaultSync();
  const merged: SetupVaultSnapshot = { ...current };

  for (const [key, value] of Object.entries(nextValues) as Array<[SetupVaultKey, string]>) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    merged[key] = trimmed;
  }

  writeSetupVault(merged);
  return merged;
}

function maskValue(value: string, secret: boolean) {
  if (!value) {
    return "Not set";
  }

  if (!secret) {
    return value.length > 42 ? `${value.slice(0, 39)}...` : value;
  }

  if (value.length <= 8) {
    return "Set";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function getSetupVaultSectionsState(
  envValues: Partial<Record<SetupVaultKey, string | null>> = {},
): SetupVaultSectionState[] {
  return setupVaultSections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      const currentValue = envValues[field.key]?.trim() || "";

      return {
        ...field,
        hasValue: Boolean(currentValue),
        preview: maskValue(currentValue, field.secret),
      };
    }),
  }));
}
