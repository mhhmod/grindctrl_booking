import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRYON_MODEL,
  assertTryOnModelConfig,
  defaultTryOnModel,
  resolveTryOnModel,
} from './models';

const ENV_NAMES = ['TRYON_MODEL', 'TRYON_MODEL_LITE', 'TRYON_MODEL_FLASH', 'TRYON_MODEL_MUSE'];

describe('try-on model resolution', () => {
  beforeEach(() => {
    ENV_NAMES.forEach((name) => delete process.env[name]);
  });

  afterEach(() => {
    ENV_NAMES.forEach((name) => delete process.env[name]);
    vi.restoreAllMocks();
  });

  describe('defaultTryOnModel', () => {
    it('is meta/muse-image when nothing is configured', () => {
      expect(DEFAULT_TRYON_MODEL).toBe('meta/muse-image');
      expect(defaultTryOnModel()).toBe('meta/muse-image');
    });

    it('prefers TRYON_MODEL, trimmed', () => {
      process.env.TRYON_MODEL = '  google/gemini-3.1-flash-image  ';
      expect(defaultTryOnModel()).toBe('google/gemini-3.1-flash-image');
    });

    it('treats a blank TRYON_MODEL as unset', () => {
      process.env.TRYON_MODEL = '   ';
      expect(defaultTryOnModel()).toBe('meta/muse-image');
    });

    it('rejects a TRYON_MODEL that is not a provider id', () => {
      process.env.TRYON_MODEL = 'lite';
      expect(() => defaultTryOnModel()).toThrow('TRYON_MODEL must be a provider model id');
    });
  });

  describe('resolveTryOnModel', () => {
    it.each([null, undefined, '', '   '])('uses the default for an empty tier (%s)', (tier) => {
      expect(resolveTryOnModel(tier)).toBe('meta/muse-image');
    });

    it.each([
      ['lite', 'TRYON_MODEL_LITE'],
      ['flash', 'TRYON_MODEL_FLASH'],
      ['muse', 'TRYON_MODEL_MUSE'],
    ])('maps the %s tier through %s', (tier, envName) => {
      process.env[envName] = 'vendor/tier-model';
      expect(resolveTryOnModel(tier)).toBe('vendor/tier-model');
    });

    it('matches tier labels case-insensitively', () => {
      process.env.TRYON_MODEL_FLASH = 'vendor/flash-model';
      expect(resolveTryOnModel(' Flash ')).toBe('vendor/flash-model');
    });

    it('falls back to TRYON_MODEL, then the default, for a known tier with no model set', () => {
      expect(resolveTryOnModel('lite')).toBe('meta/muse-image');
      process.env.TRYON_MODEL = 'vendor/global-model';
      expect(resolveTryOnModel('lite')).toBe('vendor/global-model');
    });

    it('never returns a tier label', () => {
      for (const tier of ['lite', 'flash', 'muse', 'turbo']) {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(resolveTryOnModel(tier)).toMatch(/\//);
      }
    });

    it('logs and falls back for an unknown label', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(resolveTryOnModel('turbo')).toBe('meta/muse-image');
      expect(error).toHaveBeenCalledWith('[try-on] unknown_model_tier', { tier: 'turbo' });
    });

    it('does not log for a known tier', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      resolveTryOnModel('lite');
      expect(error).not.toHaveBeenCalled();
    });

    it.each([
      'meta/muse-image',
      'google/gemini-3.1-flash-image',
      'openai/gpt-image-1-mini',
      'black-forest-labs/flux.2-pro',
      'vendor/model:free',
    ])('passes a real provider id through unchanged (%s)', (id) => {
      expect(resolveTryOnModel(id)).toBe(id);
    });

    it('throws when the tier env var holds a label instead of an id', () => {
      process.env.TRYON_MODEL_LITE = 'lite';
      expect(() => resolveTryOnModel('lite')).toThrow('TRYON_MODEL_LITE must be a provider model id');
    });
  });

  describe('assertTryOnModelConfig', () => {
    it('passes with nothing configured', () => {
      expect(() => assertTryOnModelConfig()).not.toThrow();
    });

    it('passes when every configured value is a provider id', () => {
      process.env.TRYON_MODEL = 'meta/muse-image';
      process.env.TRYON_MODEL_LITE = 'google/gemini-3.1-flash-lite-image';
      process.env.TRYON_MODEL_FLASH = 'google/gemini-3.1-flash-image';
      process.env.TRYON_MODEL_MUSE = 'meta/muse-image';
      expect(() => assertTryOnModelConfig()).not.toThrow();
    });

    it.each(ENV_NAMES)('fails the boot when %s is not a provider id', (name) => {
      process.env[name] = 'muse';
      expect(() => assertTryOnModelConfig()).toThrow(`${name} must be a provider model id`);
    });
  });
});
