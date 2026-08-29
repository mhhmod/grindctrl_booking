// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/assistant/groq-client', () => ({
  getGroqClient: vi.fn(),
  withGroqCall: vi.fn(),
  VISION_MODEL: 'test-vision',
}));

import { parseTriage, triageNote, TRIAGE_DESCRIPTION_MAX } from './triage';

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
