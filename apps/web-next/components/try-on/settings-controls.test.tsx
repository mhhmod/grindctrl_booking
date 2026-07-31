import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

/* Regression guard for the reported defect: the five-tab preview grew tall
   enough that controls scrolled underneath it and stayed hidden. Sticky must
   be conditional on container width, never unconditional.

   This asserts on source text rather than rendered output on purpose — jsdom
   has no layout engine and does not evaluate container queries, so there is no
   way to observe the actual stickiness in a unit test. The property worth
   pinning is that the unconditional `sticky top-0` never comes back. */
describe('TryOnSettingsControls preview pinning', () => {
  it('never pins the preview unconditionally', async () => {
    // vitest runs with the web-next root as cwd (see vitest.config.ts).
    const source = await readFile('components/try-on/settings-controls.tsx', 'utf8');

    expect(source).not.toContain('sticky top-0 z-10');
    expect(source).toContain('@container');
    expect(source).toContain('@3xl:sticky');
  });

  /* The first version of this fix put `@container` and `@3xl:grid-cols-*` on
     the SAME element. A container query resolves against the nearest ANCESTOR
     container, so that element could not answer its own query: the grid stayed
     one column while the preview's `@3xl:sticky` — a descendant, so it did
     match — pinned a tall preview over the controls. That rebuilt the exact
     defect being fixed, and the assertions above all still passed, because
     every string was present. This checks the relationship, not the strings. */
  it('declares the container on an ancestor of the elements that query it', async () => {
    const source = await readFile('components/try-on/settings-controls.tsx', 'utf8');

    const classAttributes = [...source.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
    const selfQuerying = classAttributes.filter(
      (value) => value.includes('@container') && /@\w+:/.test(value),
    );

    expect(selfQuerying).toEqual([]);
  });
});
