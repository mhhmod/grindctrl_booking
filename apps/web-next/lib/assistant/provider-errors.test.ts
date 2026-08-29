// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeProviderError, isModelNotFound, ProviderUnavailableError } from './errors';
import { VISION_MODEL_CANDIDATES } from '@/lib/messenger/vision-client';

const GROQ_404 =
  '404 {"error":{"message":"The model `meta-llama/llama-4-scout-17b-16e-instruct` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';

describe('isModelNotFound', () => {
  it('sees through the generic wrapper withGroqCall puts on every failure', () => {
    /* The regression: withGroqCall replaces the provider message with a
       shopper-facing sentence and keeps the real one as the cause. Matching
       on .message alone returned false for a genuine model_not_found, so
       the vision fallback gave up on its first candidate in production. */
    const wrapped = new ProviderUnavailableError(undefined, { cause: new Error(GROQ_404) });
    expect(wrapped.message).not.toContain('model_not_found');
    expect(isModelNotFound(wrapped)).toBe(true);
  });

  it('matches an unwrapped provider error too', () => {
    expect(isModelNotFound(new Error(GROQ_404))).toBe(true);
  });

  it("matches OpenRouter's phrasing as well as Groq's", () => {
    // Different vendors, same meaning to a caller holding a candidate list.
    const noEndpoints = '404 {"error":{"message":"No endpoints found for some/model."}}';
    expect(isModelNotFound(new ProviderUnavailableError(undefined, { cause: new Error(noEndpoints) }))).toBe(true);
  });

  it('treats a decommissioned model the same as a missing one', () => {
    // Groq returns 400 "decommissioned" for a model it retired and 404
    // model_not_found for one that never existed. To a caller holding a
    // candidate list both mean: try the next name.
    const decommissioned =
      '400 {"error":{"message":"The model `llama-3.2-90b-vision-preview` has been decommissioned and is no longer supported."}}';
    expect(isModelNotFound(new ProviderUnavailableError(undefined, { cause: new Error(decommissioned) }))).toBe(true);
  });

  it('is false for the errors every candidate would share', () => {
    for (const message of ['401 invalid api key', '429 rate limit exceeded', '400 image too large']) {
      expect(isModelNotFound(new ProviderUnavailableError(undefined, { cause: new Error(message) }))).toBe(false);
    }
    expect(isModelNotFound(new ProviderUnavailableError())).toBe(false);
  });
});

describe('describeProviderError', () => {
  it('joins the wrapper to its cause and survives a missing one', () => {
    expect(describeProviderError(new ProviderUnavailableError(undefined, { cause: new Error('boom') }))).toContain(
      'boom',
    );
    expect(describeProviderError(new ProviderUnavailableError())).toBe(
      "We're having trouble reaching the AI right now.",
    );
    expect(describeProviderError('plain string')).toBe('plain string');
  });
});

describe('VISION_MODEL_CANDIDATES', () => {
  it('is a non-empty list of distinct model ids', () => {
    expect(VISION_MODEL_CANDIDATES.length).toBeGreaterThan(1);
    expect(new Set(VISION_MODEL_CANDIDATES).size).toBe(VISION_MODEL_CANDIDATES.length);
  });
});
