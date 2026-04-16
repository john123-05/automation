import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateWarmupDaysLeft } from "@/lib/email-warmup-shared";
import { getStorageMode } from "@/lib/env";
import { createId } from "@/lib/sales-machine/utils";
import { getSupabaseAdminClient } from "@/lib/sales-machine/supabase";

export type WarmupAccount = {
  id: string;
  email: string;
  trialEndsOn: string;
  createdAt: string;
};

const WARMUP_DATA_DIR = path.join(process.cwd(), ".data");
const WARMUP_DATA_PATH = path.join(WARMUP_DATA_DIR, "email-warmup-accounts.json");
const WARMUP_STORAGE_BUCKET = "automation-state";
const WARMUP_STORAGE_PATH = "email-warmup/accounts.json";

const defaultWarmupAccounts: WarmupAccount[] = [
  {
    id: "warmup_john_webservice_ai_info",
    email: "john@webservice-ai.info",
    trialEndsOn: "2026-04-22",
    createdAt: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "warmup_contact_webservice_studios_com",
    email: "contact@webservice-studios.com",
    trialEndsOn: "2026-04-22",
    createdAt: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "warmup_info_webservice_studios_com",
    email: "info@webservice-studios.com",
    trialEndsOn: "2026-04-22",
    createdAt: "2026-04-09T00:00:00.000Z",
  },
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function isMissingStorageObjectError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("not found") || message.includes("no such object");
}

function isMissingStorageBucketError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("bucket not found") ||
    message.includes("not found") ||
    message.includes("does not exist")
  );
}

let ensureWarmupBucketPromise: Promise<void> | null = null;

async function ensureWarmupBucket() {
  if (!ensureWarmupBucketPromise) {
    ensureWarmupBucketPromise = (async () => {
      const client = getSupabaseAdminClient();
      const { data, error } = await client.storage.getBucket(WARMUP_STORAGE_BUCKET);

      if (!error && data) {
        return;
      }

      if (error && !isMissingStorageBucketError(error)) {
        throw new Error(error.message);
      }

      const { error: createError } = await client.storage.createBucket(WARMUP_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 1024 * 1024,
      });

      if (createError && !createError.message.toLowerCase().includes("already exists")) {
        throw new Error(createError.message);
      }
    })().catch((error) => {
      ensureWarmupBucketPromise = null;
      throw error;
    });
  }

  await ensureWarmupBucketPromise;
}

async function readLocalWarmupAccountsFile() {
  try {
    const raw = await readFile(WARMUP_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as WarmupAccount[];

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function readSupabaseWarmupAccountsFile() {
  await ensureWarmupBucket();

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage.from(WARMUP_STORAGE_BUCKET).download(WARMUP_STORAGE_PATH);

  if (error) {
    if (isMissingStorageObjectError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  const raw = await data.text();
  const parsed = JSON.parse(raw) as WarmupAccount[];

  return Array.isArray(parsed) ? parsed : null;
}

async function readWarmupAccountsFile() {
  return getStorageMode() === "supabase"
    ? readSupabaseWarmupAccountsFile()
    : readLocalWarmupAccountsFile();
}

async function writeLocalWarmupAccountsFile(accounts: WarmupAccount[]) {
  await mkdir(WARMUP_DATA_DIR, { recursive: true });
  await writeFile(WARMUP_DATA_PATH, JSON.stringify(accounts, null, 2));
}

async function writeSupabaseWarmupAccountsFile(accounts: WarmupAccount[]) {
  await ensureWarmupBucket();

  const client = getSupabaseAdminClient();
  const { error } = await client.storage
    .from(WARMUP_STORAGE_BUCKET)
    .upload(WARMUP_STORAGE_PATH, JSON.stringify(accounts, null, 2), {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeWarmupAccountsFile(accounts: WarmupAccount[]) {
  if (getStorageMode() === "supabase") {
    await writeSupabaseWarmupAccountsFile(accounts);
    return;
  }

  await writeLocalWarmupAccountsFile(accounts);
}

export async function listWarmupAccounts() {
  const stored = await readWarmupAccountsFile();
  const accounts = stored?.length ? stored : defaultWarmupAccounts;

  return [...accounts].sort((left, right) => left.email.localeCompare(right.email));
}

export async function addWarmupAccount(input: { email: string; trialEndsOn: string }) {
  const email = normalizeEmail(input.email);
  const trialEndsOn = input.trialEndsOn.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!isValidIsoDate(trialEndsOn)) {
    throw new Error("Please enter a valid trial end date.");
  }

  const accounts = await listWarmupAccounts();

  if (accounts.some((account) => account.email === email)) {
    throw new Error("That warmup account already exists.");
  }

  const nextAccount: WarmupAccount = {
    id: createId("warmup"),
    email,
    trialEndsOn,
    createdAt: new Date().toISOString(),
  };

  const nextAccounts = [...accounts, nextAccount];
  await writeWarmupAccountsFile(nextAccounts);

  return nextAccount;
}

export async function listWarmupAccountsWithStatus() {
  const accounts = await listWarmupAccounts();

  return accounts.map((account) => ({
    ...account,
    daysLeft: calculateWarmupDaysLeft(account.trialEndsOn),
    expiringSoon: calculateWarmupDaysLeft(account.trialEndsOn) <= 1,
  }));
}
