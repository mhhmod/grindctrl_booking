/** Reviewed provider ids. Legacy catalog tier aliases never go upstream. */
export const TRYON_PROVIDER_MODELS = [
  'google/gemini-3.1-flash-lite-image',
  'google/gemini-3.1-flash-image',
  'meta/muse-image',
] as const;

export type TryOnProviderModel = (typeof TRYON_PROVIDER_MODELS)[number];
export const TRYON_IMAGE_MODEL: TryOnProviderModel = 'meta/muse-image';
export const TRYON_MODEL_ALIASES: Readonly<Record<string, TryOnProviderModel>> = {
  lite: 'google/gemini-3.1-flash-lite-image',
  flash: 'google/gemini-3.1-flash-image',
  muse: 'meta/muse-image',
};

function knownModel(key: unknown): TryOnProviderModel | undefined {
  if (typeof key !== 'string') return undefined;
  const value = key.trim();
  if ((TRYON_PROVIDER_MODELS as readonly string[]).includes(value)) return value as TryOnProviderModel;
  return Object.hasOwn(TRYON_MODEL_ALIASES, value) ? TRYON_MODEL_ALIASES[value] : undefined;
}

/** Reading the fallback argument is not proof a reservation used it. */
export function getTryOnFallbackModel(): TryOnProviderModel {
  return knownModel(process.env.TRYON_MODEL) ?? TRYON_IMAGE_MODEL;
}

const reportedFallbacks = new Set<string>();
export function reportModelFallback(reason: string): void {
  if (reportedFallbacks.has(reason)) return;
  reportedFallbacks.add(reason);
  console.warn('[try-on] model_fallback', { reason, model: getTryOnFallbackModel() });
}

/** Validate again at the provider boundary, including historical job values.
 * Warnings omit untrusted keys and occur once per reason per process. */
export function resolveTryOnModel(key: unknown): TryOnProviderModel {
  const model = knownModel(key);
  if (model) return model;
  reportModelFallback(typeof key === 'string' && key.trim() ? 'unknown_model_key' : 'missing_model_key');
  return getTryOnFallbackModel();
}

export function resolveTryOnFallbackModel(): TryOnProviderModel {
  reportModelFallback('non_billable');
  return getTryOnFallbackModel();
}

/** Tier-specific environment overrides are superseded by catalog rows. */
export function reportRetiredModelSettings(): void {
  const settings = ['TRYON_MODEL_LITE', 'TRYON_MODEL_FLASH', 'TRYON_MODEL_MUSE']
    .filter((name) => process.env[name]?.trim());
  if (settings.length) console.warn('[try-on] ignored_model_settings', { settings });
}
