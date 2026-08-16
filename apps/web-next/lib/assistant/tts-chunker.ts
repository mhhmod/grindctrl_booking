/** Groq's Orpheus TTS models cap requests at 200 characters. */
const LIMIT = 200;

function splitLongSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > LIMIT) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/** Splits text into <=200 char chunks on sentence boundaries, combining short
 *  sentences together and never breaking a sentence across chunks — except a
 *  single sentence that alone exceeds the limit, which falls back to word
 *  boundaries. */
export function chunkForTts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // ؟ is Arabic's own question mark (U+061F) — Arabic sentences ending in it
  // never matched the ASCII-only [.!?] boundary, so a multi-sentence Arabic
  // reply fell through as one "sentence" and got cut mid-phrase by the
  // word-boundary fallback below instead of splitting cleanly between ideas.
  const sentences = trimmed
    .split(/(?<=[.!?؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (sentence.length > LIMIT) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      chunks.push(...splitLongSentence(sentence));
      continue;
    }

    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > LIMIT) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) chunks.push(buffer);

  return chunks;
}
