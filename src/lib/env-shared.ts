export function normalizeEnvValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  let normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const hasDoubleQuotes =
    normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length >= 2;
  const hasSingleQuotes =
    normalized.startsWith("'") && normalized.endsWith("'") && normalized.length >= 2;

  if (hasDoubleQuotes) {
    try {
      const parsed = JSON.parse(normalized);

      if (typeof parsed === "string") {
        normalized = parsed.trim();
      }
    } catch {
      normalized = normalized.slice(1, -1).trim();
    }
  } else if (hasSingleQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized || null;
}
