// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/* One scroll area per sheet or window state, and only the shared shell makes
   it (scroll-shell.tsx, the `gc-scroll` body). Anything under the shopper
   surfaces that makes its own scroll area is a scroll box inside a scroll
   box waiting to happen, so it fails here unless it is listed below with
   why it is not one. Clipping (overflow-hidden, overflow-clip) is fine: a
   shopper cannot scroll it. */
const ROOTS = ['components/try-on', 'components/messenger', 'components/embed', 'app/embed'];

const ALLOWED: Record<string, string> = {
  'components/embed/scroll-shell.css': 'The shell itself: the one scrolling body every surface uses.',
  'components/try-on/page/studio-dialogs.tsx':
    "The standalone /try-on demo page's own dialog on our site, not a store sheet or an embed.",
  'components/try-on/page/studio-parts.tsx':
    "The standalone /try-on demo page's sideways strip of looks on our site, not a store sheet or an embed.",
};

// Tailwind utilities (overflow-auto, overflow-y-scroll, [overflow-y:auto]),
// React styles (overflowY: 'auto') and CSS declarations (overflow-y: scroll).
const SCROLLING = [
  /\boverflow(?:-[xy])?-(?:auto|scroll)\b/,
  /\[overflow(?:-[xy])?:(?:auto|scroll)\]/,
  /\boverflow[XY]?\s*:\s*['"`](?:auto|scroll)['"`]/,
  /\boverflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the one-scroll-area rule', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => relative('.', path).split(sep).join('/'));

  it('finds the shopper surfaces it guards', () => {
    expect(files).toContain('components/try-on/sheet/try-on-sheet.tsx');
    expect(files).toContain('components/messenger/MessengerPanel.tsx');
    expect(files).toContain('app/embed/try-on/page.tsx');
  });

  it('lets only the shared shell make a scroll area', () => {
    const offenders = files.flatMap((file) => {
      if (ALLOWED[file]) return [];
      return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (SCROLLING.some((pattern) => pattern.test(line)) ? [`${file}:${index + 1}  ${line.trim()}`] : []));
    });
    expect(offenders).toEqual([]);
  });

  it('keeps every allowlisted file honest', () => {
    for (const file of Object.keys(ALLOWED)) {
      const source = readFileSync(file, 'utf8');
      expect(SCROLLING.some((pattern) => pattern.test(source)), `${file} no longer scrolls; drop it from the list`).toBe(true);
    }
  });
});
