import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRYON_IMAGE_MODEL, reportRetiredModelSettings } from './models';

const RETIRED = ['TRYON_MODEL', 'TRYON_MODEL_LITE', 'TRYON_MODEL_FLASH', 'TRYON_MODEL_MUSE'];

describe('try-on image model', () => {
  beforeEach(() => RETIRED.forEach((name) => delete process.env[name]));
  afterEach(() => {
    RETIRED.forEach((name) => delete process.env[name]);
    vi.restoreAllMocks();
  });

  it('is Meta Muse Image through OpenRouter', () => {
    expect(TRYON_IMAGE_MODEL).toBe('meta/muse-image');
  });

  it('reports nothing when no retired setting is present', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportRetiredModelSettings();
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports retired settings that are still present, without failing the boot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TRYON_MODEL = 'google/gemini-3.1-flash-image';
    process.env.TRYON_MODEL_LITE = 'lite';
    expect(() => reportRetiredModelSettings()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[try-on] ignored_model_settings', {
      settings: ['TRYON_MODEL', 'TRYON_MODEL_LITE'],
      model: 'meta/muse-image',
    });
  });
});
