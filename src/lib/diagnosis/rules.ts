export const RE_DIAGNOSIS_WAIT_DAYS = 90;

export function parseDateSafely(value?: string | null): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function getReDiagnosisStatus(diagnosedAt?: string | null) {
  const lastDate = parseDateSafely(diagnosedAt);

  if (!lastDate) {
    return {
      canRetake: true,
      remainingDays: 0,
      nextAvailableDate: null as string | null,
      passedDays: null as number | null,
    };
  }

  const now = new Date();
  const passedDays = diffDays(lastDate, now);
  const remainingDays = Math.max(0, RE_DIAGNOSIS_WAIT_DAYS - passedDays);

  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + RE_DIAGNOSIS_WAIT_DAYS);

  const nextAvailableDate = nextDate.toISOString().slice(0, 10);

  return {
    canRetake: remainingDays === 0,
    remainingDays,
    nextAvailableDate,
    passedDays,
  };
}