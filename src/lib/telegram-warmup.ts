import { listWarmupAccountsWithStatus } from "@/lib/email-warmup";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function looksLikeWarmupQuery(message: string) {
  const normalized = normalizeWhitespace(message.toLowerCase());

  return /\b(warm ?up|instantly|accounts?|account|trial ende|trial end|wie lange noch|how long|emails?)\b/.test(
    normalized,
  );
}

export async function getWarmupReply(rawMessage: string, language: "de" | "en" = "de") {
  const normalized = normalizeWhitespace(rawMessage.toLowerCase());
  const accounts = await listWarmupAccountsWithStatus();

  if (!accounts.length) {
    return language === "de"
      ? "Ich habe aktuell keine Warmup-Accounts gespeichert."
      : "I do not have any warmup accounts stored right now.";
  }

  const lines = accounts.map(
    (account) =>
      `${account.email} · ${account.daysLeft} ${language === "de" ? "Tage" : "days"} · ${
        language === "de" ? "endet" : "ends"
      } ${account.trialEndsOn}`,
  );

  if (/\b(welche|which|list|liste|accounts?|emails?)\b/.test(normalized)) {
    return [
      language === "de" ? "Warmup-Accounts:" : "Warmup accounts:",
      "",
      ...lines,
    ].join("\n");
  }

  if (/\b(wie lange|how long|days|tage|trial ende|trial end|ablauf|expires?)\b/.test(normalized)) {
    return [
      language === "de" ? "Warmup-Status:" : "Warmup status:",
      "",
      ...lines,
    ].join("\n");
  }

  return [
    language === "de" ? "Warmup-Accounts:" : "Warmup accounts:",
    "",
    ...lines,
  ].join("\n");
}
