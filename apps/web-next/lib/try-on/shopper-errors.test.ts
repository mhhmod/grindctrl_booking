import { describe, expect, it } from 'vitest';
import {
  classifyTryOnFailure,
  toShopperFailureMessage,
} from './shopper-errors';

/* A shopper on a merchant's storefront was shown, verbatim:

     "Insufficient credits. Add more using https://openrouter.ai/settings/credits"

   Our image provider's billing error, forwarded through error.message into
   the job record and rendered in the widget — naming our vendor, stating our
   account was out of credit, and linking our billing page, to the merchant's
   customers. */

const LEAKED = new Error(
  'Insufficient credits. Add more using https://openrouter.ai/settings/credits',
);

describe('toShopperFailureMessage', () => {
  it('never lets the provider speak to the shopper', () => {
    const shown = toShopperFailureMessage(LEAKED);

    expect(shown).not.toMatch(/openrouter/i);
    expect(shown).not.toMatch(/credit/i);
    expect(shown).not.toMatch(/https?:\/\//);
    expect(shown).toBe(
      'Try-on is unavailable right now. Please try again later — nothing was charged to you.',
    );
  });

  it('says nothing about our billing in any language', () => {
    for (const locale of ['en', 'ar']) {
      const shown = toShopperFailureMessage(LEAKED, locale);
      expect(shown).not.toMatch(/openrouter/i);
      expect(shown).not.toMatch(/https?:\/\//);
    }
  });

  /* Whatever a provider invents, the shopper gets one of ours. This is the
     property that matters: the output is drawn from a fixed set, so a new
     upstream message cannot introduce a new leak. */
  it('emits only our own sentences, whatever the provider said', () => {
    const ours = new Set([
      'Try-on is unavailable right now. Please try again later — nothing was charged to you.',
      'Try-on is busy at the moment. Please try again in a minute.',
      'That photo could not be used. Try a clear, front-facing photo of one person in good light.',
      'Try-on could not finish. Please try again.',
    ]);

    const upstream = [
      'Insufficient credits. Add more using https://openrouter.ai/settings/credits',
      'ECONNREFUSED 10.0.0.4:443',
      'Error: /var/app/lib/try-on/provider.ts:88 unexpected token',
      '401 Unauthorized: invalid api key sk-or-v1-abc123',
      'Rate limit exceeded, retry after 30s',
      'upstream connect error or disconnect/reset before headers. reset reason: overflow',
      'model returned 502',
      'Request blocked by safety system',
      '',
      'something nobody has seen before',
    ];

    for (const raw of upstream) {
      expect(ours.has(toShopperFailureMessage(new Error(raw)))).toBe(true);
    }
  });

  it('handles a non-Error throw without leaking its stringification', () => {
    expect(ours(toShopperFailureMessage({ secret: 'sk-or-v1-abc' } as unknown))).toBe(true);

    function ours(message: string) {
      return !/sk-or|secret/i.test(message);
    }
  });
});

describe('classifyTryOnFailure', () => {
  it('treats our quota and auth problems as ours, not the shopper\'s', () => {
    expect(classifyTryOnFailure(LEAKED)).toBe('service_unavailable');
    expect(classifyTryOnFailure(new Error('402 payment required'))).toBe('service_unavailable');
    expect(classifyTryOnFailure(new Error('invalid api key'))).toBe('service_unavailable');
  });

  it('separates "come back in a minute" from "this is broken"', () => {
    expect(classifyTryOnFailure(new Error('429 too many requests'))).toBe('busy');
    expect(classifyTryOnFailure(new Error('upstream timeout'))).toBe('busy');
  });

  /* The one kind the shopper can actually do something about, so it wins over
     a message that also looks like a service problem. */
  it('tells the shopper when the photo is the problem', () => {
    expect(classifyTryOnFailure(new Error('blocked by safety system'))).toBe('photo_rejected');
    expect(classifyTryOnFailure(new Error('no face detected in image'))).toBe('photo_rejected');
    expect(classifyTryOnFailure(new Error('safety: quota-like wording too'))).toBe(
      'photo_rejected',
    );
  });

  it('falls back rather than guessing', () => {
    expect(classifyTryOnFailure(new Error('kaboom'))).toBe('unknown');
    expect(classifyTryOnFailure(undefined)).toBe('unknown');
  });
});
