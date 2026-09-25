export const DEFAULT_TRYON_MODEL = 'meta/muse-image';

/* Plan and pack rows store a tier label (the tryon_plans_model_check
   constraint allows only these three), never a provider model id. Each tier
   maps to its own env var so ops can repoint a tier without a migration. */
const TIER_ENV: Record<string, string> = {
  lite: 'TRYON_MODEL_LITE',
  flash: 'TRYON_MODEL_FLASH',
  muse: 'TRYON_MODEL_MUSE',
};

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

function envModel(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (!SLUG_RE.test(value)) throw new Error(`${name} must be a provider model id such as vendor/model`);
  return value;
}

export function defaultTryOnModel(): string {
  return envModel('TRYON_MODEL') ?? DEFAULT_TRYON_MODEL;
}

/** Turns a plan tier label (lite, flash, muse) into a provider model id. Never sends a label upstream. */
export function resolveTryOnModel(tier: string | null | undefined): string {
  const raw = tier?.trim();
  if (!raw) return defaultTryOnModel();
  if (SLUG_RE.test(raw)) return raw;
  const envName = TIER_ENV[raw.toLowerCase()];
  if (!envName) console.error('[try-on] unknown_model_tier', { tier: raw });
  return (envName ? envModel(envName) : null) ?? defaultTryOnModel();
}

/** Called once at startup when TRYON_MODE=live, so a bad value fails the boot, not a shopper. */
export function assertTryOnModelConfig(): void {
  defaultTryOnModel();
  Object.values(TIER_ENV).forEach(envModel);
}
