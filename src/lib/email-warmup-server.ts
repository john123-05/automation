import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateWarmupDaysLeft } from "@/lib/email-warmup-shared";
import { createId } from "@/lib/sales-machine/utils";

export type WarmupAccount = {
  id: string;
  email: string;
  trialEndsOn: string;
  createdAt: string;
};

const WARMUP_DATA_DIR = path.join(process.cwd(), ".data");
const WARMUP_DATA_PATH = path.join(WARMUP_DATA_DIR, "email-warmup-accounts.json");

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

async function readWarmupAccountsFile() {
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

async function writeWarmupAccountsFile(accounts: WarmupAccount[]) {
  await mkdir(WARMUP_DATA_DIR, { recursive: true });
  await writeFile(WARMUP_DATA_PATH, JSON.stringify(accounts, null, 2));
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
