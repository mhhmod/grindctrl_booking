// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());
const listAvailableModels = vi.hoisted(() => vi.fn(async () => ['chat-only-model']));

vi.mock('@/lib/assistant/groq-client', () => ({
  getGroqClient: () => ({ chat: { completions: { create } } }),
  // Pass-through: the real wrapper only logs and re-wraps.
  withGroqCall: (_label: string, fn: () => Promise<unknown>) => fn(),
  isModelNotFound: (error: unknown) =>
    /model_not_found|does not exist or you do not have access/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  listAvailableModels,
  VISION_MODEL_CANDIDATES: ['model-a', 'model-b'],
}));

import {
  NoVisionModelError,
  parseTriage,
  triageAttachment,
  triageNote,
  TRIAGE_DESCRIPTION_MAX,
  __resetVisionModelCacheForTests,
} from './triage';

const GOOD = {
  choices: [{ message: { content: '{"description":"a torn sleeve","category":"damaged","confidence":0.9}' } }],
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function modelNotFound(model: string) {
  return new Error(`404 The model \`${model}\` does not exist or you do not have access to it.`);
}

beforeEach(() => {
  create.mockReset();
  listAvailableModels.mockClear();
  // Module-level cache; without this the previous test's winner leaks in.
  __resetVisionModelCacheForTests();
});

/* Groq retires vision models often — llama-4-scout returned model_not_found
   in production weeks after being current. A pinned name means the feature
   dies silently each time, so the order is a preference list. */
describe('triageAttachment model selection', () => {
  it('falls past a retired model to one that answers', async () => {
    create.mockRejectedValueOnce(modelNotFound('model-a')).mockResolvedValueOnce(GOOD);
    const result = await triageAttachment({ bytes: PNG, mime: 'image/png' });
    expect(result?.category).toBe('damaged');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['model-a', 'model-b']);
  });

  it('remembers the winner instead of re-probing every upload', async () => {
    create.mockRejectedValueOnce(modelNotFound('model-a')).mockResolvedValue(GOOD);
    await triageAttachment({ bytes: PNG, mime: 'image/png' });
    create.mockClear();
    await triageAttachment({ bytes: PNG, mime: 'image/png' });
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['model-b']);
  });

  it('does not burn a request per candidate on an error another model shares', async () => {
    // Auth failures and rate limits fail identically everywhere.
    create.mockRejectedValue(new Error('401 invalid api key'));
    await expect(triageAttachment({ bytes: PNG, mime: 'image/png' })).rejects.toThrow('invalid api key');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('names the models the key CAN use once every candidate is gone', async () => {
    create.mockRejectedValue(modelNotFound('whatever'));
    await expect(triageAttachment({ bytes: PNG, mime: 'image/png' })).rejects.toThrow(NoVisionModelError);
    expect(listAvailableModels).toHaveBeenCalled();
  });

  it('re-probes the list when the cached model is retired mid-process', async () => {
    // This is how the pinned model died in the first place. Caching the
    // winner must not mean failing for the rest of the deploy when Groq
    // retires it an hour later.
    create.mockResolvedValueOnce(GOOD);
    await triageAttachment({ bytes: PNG, mime: 'image/png' }); // caches model-a
    create.mockReset();
    create.mockRejectedValueOnce(modelNotFound('model-a')).mockResolvedValueOnce(GOOD);

    const result = await triageAttachment({ bytes: PNG, mime: 'image/png' });

    expect(result?.category).toBe('damaged');
    // Retries the OTHER candidate, and does not re-try the dead one twice.
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['model-a', 'model-b']);
  });
});

describe('parseTriage', () => {
  it('reads a clean object', () => {
    expect(parseTriage('{"description":"A torn seam on a blue shirt","category":"damaged","confidence":0.9}')).toEqual(
      { description: 'A torn seam on a blue shirt', category: 'damaged', confidence: 0.9 },
    );
  });

  it('finds the object inside a fenced or chatty reply', () => {
    const wrapped = 'Here you go:\n```json\n{"description":"Wrong colour","category":"wrong_item","confidence":0.7}\n```';
    expect(parseTriage(wrapped)?.category).toBe('wrong_item');
  });

  it('falls back to unclear for an unknown category rather than inventing one', () => {
    expect(
      parseTriage('{"description":"x","category":"REFUND_THE_CUSTOMER","confidence":1}')?.category,
    ).toBe('unclear');
  });

  it('clamps confidence into range and treats junk as zero', () => {
    expect(parseTriage('{"description":"x","category":"unclear","confidence":9}')?.confidence).toBe(1);
    expect(parseTriage('{"description":"x","category":"unclear","confidence":-4}')?.confidence).toBe(0);
    expect(parseTriage('{"description":"x","category":"unclear","confidence":"lots"}')?.confidence).toBe(0);
  });

  it('caps the description so a model cannot write an essay into the transcript', () => {
    const long = parseTriage(JSON.stringify({ description: 'a'.repeat(900), category: 'damaged', confidence: 0.8 }));
    expect(long?.description.length).toBe(TRIAGE_DESCRIPTION_MAX);
  });

  it('returns null for junk, prose and a missing description', () => {
    expect(parseTriage('I think the shirt is torn.')).toBeNull();
    expect(parseTriage('{not json}')).toBeNull();
    expect(parseTriage('{"category":"damaged","confidence":1}')).toBeNull();
    expect(parseTriage('')).toBeNull();
  });

  it('unwraps a single-element array, which is the same leniency as a fence', () => {
    // Extraction runs from the first { to the last }, so a model that wraps
    // its object in an array is read, not rejected. Documented rather than
    // accidental: the alternative is discarding a usable classification.
    expect(parseTriage('[{"description":"x","category":"damaged","confidence":0.5}]')).toEqual({
      description: 'x',
      category: 'damaged',
      confidence: 0.5,
    });
  });
});

describe('triageNote', () => {
  it('says it could not tell rather than presenting a low-confidence guess', () => {
    const note = triageNote({ description: 'maybe a stain', category: 'damaged', confidence: 0.2 }, 'en');
    expect(note).not.toContain('maybe a stain');
    expect(note.toLowerCase()).toContain("couldn't tell");
  });

  it('reports the description once confident, in the shopper locale', () => {
    const triage = { description: 'A cracked mug', category: 'damaged' as const, confidence: 0.8 };
    expect(triageNote(triage, 'en')).toContain('A cracked mug');
    expect(triageNote(triage, 'ar')).toContain('A cracked mug');
    expect(triageNote(triage, 'ar')).toMatch(/[؀-ۿ]/);
  });
});
