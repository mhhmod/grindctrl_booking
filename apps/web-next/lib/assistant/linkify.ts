export interface TextSegment {
  type: 'text';
  value: string;
}

export interface LinkSegment {
  type: 'link';
  href: string;
  label: string;
  /** External links open in a new tab; internal ones navigate the current
   *  site (and should go through next/link for client-side transitions). */
  external: boolean;
}

export type MessageSegment = TextSegment | LinkSegment;

const ABSOLUTE_URL = /https?:\/\/[^\s<>"']+/g;
// Trailing punctuation almost always belongs to the sentence, not the URL —
// "visit https://x.com." shouldn't turn the period into part of the link.
const TRAILING_PUNCTUATION = /[.,!?;:)\]}'"]+$/;

/* The system prompt is only ever told to mention these two relative paths
   (see system-prompt.ts) — matching that exact, known set is simpler and
   safer than a generic "any /word looks like a path" regex, which would
   false-positive on things like fractions or unrelated slashes in prose. */
const INTERNAL_PATHS: { path: string; pattern: RegExp }[] = [
  { path: '/try-on', pattern: /\/try-on\b/g },
  { path: '/pricing', pattern: /\/pricing\b/g },
];

function splitTrailingPunctuation(url: string): { href: string; trailing: string } {
  const match = url.match(TRAILING_PUNCTUATION);
  if (!match) return { href: url, trailing: '' };
  return { href: url.slice(0, url.length - match[0].length), trailing: match[0] };
}

function linkifyInternalPaths(text: string): MessageSegment[] {
  let segments: MessageSegment[] = [{ type: 'text', value: text }];
  for (const { path, pattern } of INTERNAL_PATHS) {
    segments = segments.flatMap((segment): MessageSegment[] => {
      if (segment.type !== 'text') return [segment];
      const parts = segment.value.split(pattern);
      if (parts.length === 1) return [segment];
      const result: MessageSegment[] = [];
      parts.forEach((part, index) => {
        if (part) result.push({ type: 'text', value: part });
        if (index < parts.length - 1) result.push({ type: 'link', href: path, label: path, external: false });
      });
      return result;
    });
  }
  return segments;
}

/** Splits assistant reply text into plain-text and link segments, so real
 *  URLs (the booking link) and the two paths the assistant is ever told to
 *  mention (/try-on, /pricing) render as actual clickable links instead of
 *  inert text a visitor can't tap. */
export function linkifyMessage(text: string): MessageSegment[] {
  const urls = text.match(ABSOLUTE_URL) ?? [];
  const pieces = text.split(ABSOLUTE_URL);

  const segments: MessageSegment[] = [];
  pieces.forEach((piece, index) => {
    segments.push(...linkifyInternalPaths(piece));
    if (index < urls.length) {
      const { href, trailing } = splitTrailingPunctuation(urls[index]);
      segments.push({ type: 'link', href, label: href, external: true });
      if (trailing) segments.push({ type: 'text', value: trailing });
    }
  });

  return segments.filter((s) => !(s.type === 'text' && s.value === ''));
}
