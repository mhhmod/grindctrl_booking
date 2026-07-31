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
});
