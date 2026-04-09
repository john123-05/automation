import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStorageMode } from "@/lib/env";
import { getSupabaseAdminClient, salesMachineTables } from "@/lib/sales-machine/supabase";
import type { ConnectedMailbox, SalesMachineDb } from "@/lib/sales-machine/types";

type ConnectedMailboxRow = {
  id: string;
  provider: ConnectedMailbox["provider"];
  email: string;
  display_name: string | null;
  status: ConnectedMailbox["status"];
  signature: string | null;
  daily_limit: number | null;
  oauth_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DB_PATH = path.join(process.cwd(), ".data", "sales-machine.json");

function mailboxFromRow(row: ConnectedMailboxRow): ConnectedMailbox {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    signature: row.signature,
    dailyLimit: row.daily_limit,
    oauthData: row.oauth_data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readLocalConnectedMailboxes() {
  const raw = (await readFile(DB_PATH, "utf8")).trim();
  const db = JSON.parse(raw) as SalesMachineDb;
  return db.connectedMailboxes ?? [];
}

async function readSupabaseConnectedMailboxes() {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(salesMachineTables.connectedMailboxes)
    .select("*")
    .returns<ConnectedMailboxRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mailboxFromRow);
}

export async function readConnectedMailboxes() {
  return getStorageMode() === "supabase"
    ? readSupabaseConnectedMailboxes()
    : readLocalConnectedMailboxes();
}
