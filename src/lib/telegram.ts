import { getEnv } from "@/lib/env";

type InboxTelegramAlertInput = {
  mailboxEmail: string;
  fromAddress: string | null;
  subject: string;
  body: string;
  sentAt: string;
  threadId: string;
};

type TelegramSystemAlertInput = {
  title: string;
  lines: string[];
};

type TelegramInlineButton = {
  text: string;
  callback_data: string;
};

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeTelegramMarkdown(value: string) {
  return value.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const env = getEnv();

  if (!env.telegramBotToken || !env.telegramChatId) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Telegram ${method} failed: ${message}`);
  }

  return response.json();
}

export async function downloadTelegramBotFile(fileId: string) {
  const env = getEnv();

  if (!env.telegramBotToken) {
    throw new Error("Telegram bot token is not configured.");
  }

  const metadata = (await callTelegram("getFile", {
    file_id: fileId,
  })) as {
    ok?: boolean;
    result?: {
      file_path?: string;
    };
  };

  const filePath = metadata.result?.file_path;

  if (!filePath) {
    throw new Error("Telegram did not return a downloadable file path.");
  }

  const response = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${filePath}`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Telegram file download failed: ${message}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function sendTelegramTextMessage(input: {
  chatId?: string | number | null;
  text: string;
  markdown?: boolean;
  inlineKeyboard?: TelegramInlineButton[][];
}) {
  const env = getEnv();
  const chatId = input.chatId ?? env.telegramChatId;

  if (!env.telegramBotToken || !chatId) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: input.text,
    parse_mode: input.markdown ? "MarkdownV2" : undefined,
    disable_web_page_preview: true,
    reply_markup: input.inlineKeyboard
      ? {
          inline_keyboard: input.inlineKeyboard,
        }
      : undefined,
  });
}

export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string) {
  return callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function sendTelegramDocument(input: {
  chatId?: string | number | null;
  fileName: string;
  bytes: Buffer | Uint8Array;
  caption?: string;
}) {
  const env = getEnv();
  const chatId = input.chatId ?? env.telegramChatId;

  if (!env.telegramBotToken || !chatId) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const formData = new FormData();
  const normalizedBytes = Uint8Array.from(input.bytes);
  const blob = new Blob([normalizedBytes.buffer], { type: "application/pdf" });

  formData.append("chat_id", String(chatId));
  formData.append("document", blob, input.fileName);

  if (input.caption) {
    formData.append("caption", input.caption);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Telegram sendDocument failed: ${message}`);
  }

  return response.json();
}

export async function sendInboxTelegramAlert(input: InboxTelegramAlertInput) {
  const env = getEnv();

  if (!env.telegramBotToken || !env.telegramChatId) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const inboxUrl = env.appUrl
    ? `${env.appUrl.replace(/\/+$/, "")}/outreach/inbox?threadId=${encodeURIComponent(input.threadId)}`
    : null;
  const bodyPreview = truncate(input.body.trim() || "(empty body)", 1200);
  const lines = [
    "*New inbound email*",
    "",
    `*Mailbox:* ${escapeTelegramMarkdown(input.mailboxEmail)}`,
    `*From:* ${escapeTelegramMarkdown(input.fromAddress ?? "Unknown sender")}`,
    `*Subject:* ${escapeTelegramMarkdown(input.subject)}`,
    `*Received:* ${escapeTelegramMarkdown(input.sentAt)}`,
    "",
    escapeTelegramMarkdown(bodyPreview),
  ];

  if (inboxUrl) {
    lines.push("", `[Open in inbox](${inboxUrl})`);
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: env.telegramChatId,
        text: lines.join("\n"),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Telegram alert failed: ${message}`);
  }

  return { sent: true as const };
}

export async function sendTelegramSystemAlert(input: TelegramSystemAlertInput) {
  const env = getEnv();

  if (!env.telegramBotToken || !env.telegramChatId) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const text = [`*${escapeTelegramMarkdown(input.title)}*`, "", ...input.lines.map((line) => escapeTelegramMarkdown(line))].join(
    "\n",
  );
  const response = await fetch(
    `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: env.telegramChatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Telegram system alert failed: ${message}`);
  }

  return { sent: true as const };
}

export async function sendTelegramDebugAlert(line: string) {
  return sendTelegramSystemAlert({
    title: "Inbox debug",
    lines: [line],
  });
}
