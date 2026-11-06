import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRYON_IMAGE_MODEL, TRYON_PROVIDER_MODELS, reportRetiredModelSettings, resolveTryOnModel, getTryOnFallbackModel } from './models';

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

  it('reports tier settings as retired but retains TRYON_MODEL as the fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TRYON_MODEL = 'google/gemini-3.1-flash-image';
    process.env.TRYON_MODEL_LITE = 'lite';
    expect(() => reportRetiredModelSettings()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[try-on] ignored_model_settings', {
      settings: ['TRYON_MODEL_LITE'],
    });
    expect(getTryOnFallbackModel()).toBe('google/gemini-3.1-flash-image');
  });

  it.each(TRYON_PROVIDER_MODELS)('allows reviewed provider id %s', (model) => {
    expect(resolveTryOnModel(model)).toBe(model);
  });

  it.each([
    ['lite', 'google/gemini-3.1-flash-lite-image'],
    ['flash', 'google/gemini-3.1-flash-image'],
    ['muse', 'meta/muse-image'],
  ])('maps legacy %s tier to a provider id', (key, model) => {
    expect(resolveTryOnModel(key)).toBe(model);
  });

  it('logs a fallback once per reason and never logs unknown catalog strings', async () => {
    vi.resetModules();
    const { resolveTryOnModel: resolve } = await import('./models');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TRYON_MODEL = 'google/gemini-3.1-flash-image';
    expect(resolve('unknown/provider')).toBe('google/gemini-3.1-flash-image');
    expect(resolve('another/unknown')).toBe('google/gemini-3.1-flash-image');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('unknown/provider');
  });

  it.each(['unknown/provider', '__proto__', 'constructor', 'toString', ''])('rejects an unsafe global fallback %s', (value) => {
    process.env.TRYON_MODEL = value;
    expect(getTryOnFallbackModel()).toBe(TRYON_IMAGE_MODEL);
  });
});
