export function calculateWarmupDaysLeft(trialEndsOn: string, now = new Date()) {
  const trialEnd = new Date(`${trialEndsOn}T00:00:00.000Z`);
  const diffMs = trialEnd.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function formatWarmupTrialEndDate(trialEndsOn: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(`${trialEndsOn}T00:00:00.000Z`));
}
