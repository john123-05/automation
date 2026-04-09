import { ImapFlow } from "imapflow";
import { getEnv } from "@/lib/env";
import { getManualMailboxConfig } from "@/lib/sales-machine/mailbox-config";
import { readConnectedMailboxes } from "@/lib/sales-machine/mailbox-store";
import { sendTelegramDebugAlert, sendTelegramSystemAlert } from "@/lib/telegram";

type WorkerState = {
  mailboxId: string;
  mailboxEmail: string;
  hadHealthyConnection: boolean;
  disconnectAlertSent: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerInboxSync(mailboxId: string) {
  const env = getEnv();
  const appUrl = env.appUrl?.replace(/\/+$/, "");

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for the inbox idle worker.");
  }

  const response = await fetch(`${appUrl}/api/inbox/sync?mailboxId=${encodeURIComponent(mailboxId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Inbox sync failed.");
  }
}

async function alertDisconnect(state: WorkerState, reason: string) {
  if (state.disconnectAlertSent) {
    return;
  }

  state.disconnectAlertSent = true;

  try {
    await sendTelegramSystemAlert({
      title: "Inbox connection interrupted",
      lines: [
        `Mailbox: ${state.mailboxEmail}`,
        `Reason: ${reason}`,
      ],
    });
  } catch (error) {
    console.error("Failed to send disconnect alert.", error);
  }
}

async function alertReconnect(state: WorkerState) {
  if (!state.disconnectAlertSent && state.hadHealthyConnection) {
    return;
  }

  state.disconnectAlertSent = false;
  state.hadHealthyConnection = true;

  try {
    await sendTelegramSystemAlert({
      title: "Inbox connection restored",
      lines: [`Mailbox: ${state.mailboxEmail}`],
    });
  } catch (error) {
    console.error("Failed to send reconnect alert.", error);
  }
}

async function watchMailbox(mailboxId: string) {
  const state: WorkerState = {
    mailboxId,
    mailboxEmail: mailboxId,
    hadHealthyConnection: false,
    disconnectAlertSent: false,
  };

  while (true) {
    let client: ImapFlow | null = null;

    try {
      const mailboxes = await readConnectedMailboxes();
      const mailbox = mailboxes.find((candidate) => candidate.id === mailboxId);

      if (!mailbox || mailbox.status !== "connected") {
        await alertDisconnect(state, "Mailbox is no longer connected.");
        await sleep(30_000);
        continue;
      }

      const manualConfig = getManualMailboxConfig(mailbox);

      if (!manualConfig?.imap) {
        await alertDisconnect(state, "IMAP configuration is missing.");
        await sleep(30_000);
        continue;
      }

      state.mailboxEmail = mailbox.email;
      client = new ImapFlow({
        host: manualConfig.imap.host,
        port: manualConfig.imap.port,
        secure: manualConfig.imap.secure,
        auth: {
          user: manualConfig.imap.username,
          pass: manualConfig.imap.password,
        },
        logger: false,
      });

      let closeReason = "Connection closed.";
      let processing = Promise.resolve();
      const env = getEnv();
      const debugEnabled = process.env.INBOX_IDLE_DEBUG?.trim() === "true";

      client.on("error", (error) => {
        closeReason = error instanceof Error ? error.message : String(error);
      });

      client.on("close", () => {
        void alertDisconnect(state, closeReason);
      });

      client.on("exists", (event) => {
        if (event.count <= event.prevCount) {
          return;
        }

        processing = processing
          .then(async () => {
            console.log(
              `[inbox-idle] New message event for ${mailbox.email}: ${event.prevCount} -> ${event.count}`,
            );

            if (debugEnabled && env.telegramChatId && env.telegramBotToken) {
              try {
                await sendTelegramDebugAlert(
                  `${mailbox.email}: IMAP exists event ${event.prevCount} -> ${event.count}`,
                );
              } catch (error) {
                console.error("Failed to send IMAP debug alert.", error);
              }
            }

            await triggerInboxSync(mailboxId);
          })
          .catch((error) => {
            console.error(`Inbox sync failed for ${mailbox.email}.`, error);
          });
      });

      await client.connect();
      await client.mailboxOpen("INBOX", { readOnly: true });
      await alertReconnect(state);
      await triggerInboxSync(mailboxId);

      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        client?.once("close", finish);
      });
      await processing;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await alertDisconnect(state, message);
    } finally {
      await client?.logout().catch(() => undefined);
    }

    await sleep(15_000);
  }
}

async function main() {
  if (process.env.INBOX_IDLE_SINGLETON_FILE?.trim()) {
    console.warn("INBOX_IDLE_SINGLETON_FILE is not implemented yet.");
  }

  const mailboxes = (await readConnectedMailboxes()).filter((mailbox) => {
    if (mailbox.status !== "connected" || mailbox.provider !== "smtp") {
      return false;
    }

    return Boolean(getManualMailboxConfig(mailbox)?.imap);
  });

  if (!mailboxes.length) {
    console.log("No IMAP-enabled SMTP mailboxes found for inbox-idle worker.");
    return;
  }

  console.log(`Starting inbox-idle worker for ${mailboxes.length} mailbox(es).`);
  await Promise.all(mailboxes.map((mailbox) => watchMailbox(mailbox.id)));
}

void main().catch((error) => {
  console.error("Inbox idle worker failed.", error);
  process.exit(1);
});
