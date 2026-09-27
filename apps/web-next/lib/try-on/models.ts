/* Every try-on image is made by one model: Meta Muse Image through
   OpenRouter. That holds for every plan, every top-up pack and the public
   demo, so no plan renders with a different or better model, and no
   environment variable can swap it. Plan and pack rows still carry a tier
   label (lite, flash, muse) for the credit ledger; it no longer picks the
   model. */
export const TRYON_IMAGE_MODEL = 'meta/muse-image';

/* Settings that used to pick a model per plan tier. They do nothing now. */
const RETIRED_MODEL_SETTINGS = ['TRYON_MODEL', 'TRYON_MODEL_LITE', 'TRYON_MODEL_FLASH', 'TRYON_MODEL_MUSE'];

/** Called once at startup when TRYON_MODE=live: a leftover model setting is
 *  reported, so nobody believes it still chooses the model. */
export function reportRetiredModelSettings(): void {
  const settings = RETIRED_MODEL_SETTINGS.filter((name) => process.env[name]?.trim());
  if (settings.length > 0) {
    console.warn('[try-on] ignored_model_settings', { settings, model: TRYON_IMAGE_MODEL });
  }
}
