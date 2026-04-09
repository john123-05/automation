export function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) {
    return "Unavailable";
  }

  const normalizedCurrency = currency?.trim().toUpperCase() || "USD";
  const normalizedAmount = Math.abs(amount) < 0.005 ? 0 : amount;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  }).format(normalizedAmount);
}

export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function formatDaysLeft(daysLeft: number | null) {
  if (daysLeft === null) {
    return "Not configured";
  }

  return `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

export function formatDateLabel(date: Date | null) {
  if (!date) {
    return "Not configured";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function calculateDaysLeft({
  trialStartDate,
  trialLengthDays,
  now,
}: {
  trialStartDate: Date;
  trialLengthDays: number;
  now: Date;
}) {
  const trialEndsAt = addUtcDays(startOfUtcDay(trialStartDate), trialLengthDays);
  const diffMs = trialEndsAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function calculateTrialEndDate({
  trialStartDate,
  trialLengthDays,
}: {
  trialStartDate: Date;
  trialLengthDays: number;
}) {
  return addUtcDays(startOfUtcDay(trialStartDate), trialLengthDays);
}

export function parseTrialCreditUsd(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTrialStartDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
