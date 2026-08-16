import { describe, expect, it } from 'vitest';
import { chunkForTts } from './tts-chunker';

const LIMIT = 200;

describe('chunkForTts', () => {
  it('returns a single chunk for text well under the limit', () => {
    const chunks = chunkForTts('Hello there. How can I help you today?');

    expect(chunks).toEqual(['Hello there. How can I help you today?']);
  });

  it('combines short sentences into one chunk when they fit together', () => {
    const chunks = chunkForTts('Sure. I can help with that. What size are you looking for?');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Sure. I can help with that. What size are you looking for?');
  });

  it('splits onto a new chunk once adding the next sentence would exceed the limit, never breaking a sentence', () => {
    const sentenceA = 'A'.repeat(120) + '.';
    const sentenceB = 'B'.repeat(120) + '.';

    const chunks = chunkForTts(`${sentenceA} ${sentenceB}`);

    expect(chunks).toEqual([sentenceA, sentenceB]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(LIMIT);
  });

  it('splits a single sentence longer than the limit on word boundaries', () => {
    const longSentence = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') + '.';
    expect(longSentence.length).toBeGreaterThan(LIMIT);

    const chunks = chunkForTts(longSentence);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(LIMIT);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(longSentence.replace(/\s+/g, ' '));
  });

  it('returns an empty array for empty input', () => {
    expect(chunkForTts('')).toEqual([]);
    expect(chunkForTts('   ')).toEqual([]);
  });

  it('splits Arabic sentences on the Arabic question mark (؟), not just ASCII punctuation', () => {
    const sentenceA = 'م'.repeat(120) + '؟';
    const sentenceB = 'ن'.repeat(120) + '.';

    const chunks = chunkForTts(`${sentenceA} ${sentenceB}`);

    expect(chunks).toEqual([sentenceA, sentenceB]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(LIMIT);
  });
});
