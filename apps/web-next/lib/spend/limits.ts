/** Operator overrides only. Empty means inherit the environment at read time. */
export type SpendLimits = { storeChatDailyTurns?: number; tryOnDailyLooks?: number };
export type SpendLimitKey = keyof SpendLimits;
export const SPEND_LIMIT_KEYS: SpendLimitKey[] = ['storeChatDailyTurns', 'tryOnDailyLooks'];

export function validSpendLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

export function spendLimits(settings: unknown): SpendLimits {
  const raw = (settings as { spend_limits?: SpendLimits } | null)?.spend_limits;
  const result: SpendLimits = {};
  for (const key of SPEND_LIMIT_KEYS) if (validSpendLimit(raw?.[key])) result[key] = raw![key];
  return result;
}

export function effectiveSpendLimit(override: unknown, fallback: number): number {
  return validSpendLimit(override) ? override : fallback;
}

export function envDailyLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
