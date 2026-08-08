import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* Deliberately watches ONE file.

   The try-on page is an async server component behind Clerk auth, so Testing
   Library cannot render it and the strong Arabic-render gate used for the
   settings panel is unavailable here. A source scan is the weaker substitute,
   and scoping it to one file is what keeps it usable: a gate reporting 159
   findings across the whole dashboard on day one gets switched off. Widening
   it means adding a path here on purpose. */
/* Resolved from the vitest root (apps/web-next) rather than import.meta.url,
   which is not a file: URL under vitest's transform. */
const WATCHED = path.join(process.cwd(), 'app/dashboard/try-on/page.tsx');

/* JSX text children: >Some English text< */
const JSX_TEXT = />\s*[A-Z][A-Za-z]*(?:\s+[A-Za-z]+){1,}\s*</g;

/* User-facing string props. className, href and id are excluded — not copy. */
const COPY_PROPS = /\b(?:aria-label|placeholder|title|alt)\s*=\s*"([^"]{2,})"/g;

/* Template literals gluing letters to a value: `${n}s`, `day${s}`, `Period ends ${d}`.

   This third check exists because the first two were both proven blind in this
   branch. A seconds suffix inside a template literal is neither a JSX text
   child nor a string prop, and it shipped English past both. Backtick strings
   holding an interpolation AND a run of letters are the shape that hid it. */
const TEMPLATE_WITH_LETTERS = /`[^`]*\$\{[^}]*\}[^`]*`/g;

async function source(): Promise<string> {
  return readFile(WATCHED, 'utf8');
}

describe('app/dashboard/try-on/page.tsx holds no hardcoded copy', () => {
  it('has no English JSX text children', async () => {
    const found = [...(await source()).matchAll(JSX_TEXT)].map((m) => m[0].trim());

    expect(found, `Hardcoded JSX text: ${found.join(' | ')}`).toEqual([]);
  });

  it('has no hardcoded user-facing string props', async () => {
    const found = [...(await source()).matchAll(COPY_PROPS)].map((m) => m[1]);

    expect(found, `Hardcoded copy props: ${found.join(' | ')}`).toEqual([]);
  });

  it('has no words glued to values inside template literals', async () => {
    const suspicious = [...(await source()).matchAll(TEMPLATE_WITH_LETTERS)]
      .map((m) => m[0])
      /* Strip the interpolations, then look at what literal text remains.
         Two or more consecutive letters is a word; a lone letter is a unit
         already routed through copy, and CSS-ish fragments have no letters
         outside their interpolations at all. */
      .filter((literal) => /[A-Za-z]{2,}/.test(literal.replace(/\$\{[^}]*\}/g, '')));

    expect(
      suspicious,
      `Words glued to values in a template literal: ${suspicious.join(' | ')}`,
    ).toEqual([]);
  });
});
