/* Guards the prefers-reduced-motion contract.

   The setting means "reduce motion", not "remove all feedback". Windows
   Settings > Accessibility > Visual effects > Animation effects: Off makes
   Chrome and Edge report `reduce`, so this path is what a real slice of
   users see every day, not an edge case. A previous version disabled every
   animation AND every transition on effectively every element, which made
   the product read as broken rather than calm.

   These assertions are on the stylesheet text because the rules are static
   CSS: there is no component to render that would prove the cascade. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

function reducedMotionBlock(): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(start, 'no prefers-reduced-motion block found').toBeGreaterThan(-1);

  // Walk braces from the block's opening one so we capture exactly this block.
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces in the reduced-motion block');
}

describe('prefers-reduced-motion', () => {
  const block = reducedMotionBlock();

  it('does not collapse every transition to nothing', () => {
    // 0.01ms is the blanket-kill idiom. It strips hover and focus feedback
    // across the whole UI, which is what made the site feel dead.
    expect(block).not.toMatch(/transition-duration:\s*0\.01ms/);
  });

  it('keeps colour and opacity feedback on interactive surfaces', () => {
    expect(block).toMatch(/transition-property:[^;]*opacity/);
    expect(block).toMatch(/transition-property:[^;]*background-color/);
  });

  it('does not keep transform in the surviving transition set', () => {
    const props = block.match(/transition-property:[^;]*/g) ?? [];
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(p).not.toMatch(/transform/);
  });

  it('leaves entrance-animated content visible instead of stuck hidden', () => {
    // These classes start at opacity 0 and animate in. If the animation is
    // cancelled without pinning opacity, the content never appears at all.
    for (const cls of ['gc-fade-in-up', 'gc-step-appear', 'gc-scroll-reveal']) {
      // [\s\S] instead of the s flag: this file compiles under the app's
      // TS target, which predates dotAll.
      const rule = block.match(new RegExp(`\\.${cls}[^{]*\\{[^}]*\\}`));
      expect(rule, `${cls} is not handled under reduced motion`).not.toBeNull();
      expect(rule![0], `${cls} must be pinned visible`).toMatch(
        /opacity:\s*1/,
      );
    }
  });

  it('stops the ambient background from drifting', () => {
    expect(block).toMatch(/\.gc-aurora span[^{]*\{[^}]*animation:\s*none/);
  });
});

describe('ambient background cost', () => {
  // The aurora is full-viewport and always on, so it is the one effect that
  // can tax every scroll on every page. These guard the two mistakes that
  // made it expensive the first time.
  // Match the .gc-aurora rule bodies specifically. Slicing a range of the
  // file swept in unrelated rules and reported false failures.
  const auroraRules = (css.match(/\.gc-aurora[^{]*\{[^}]*\}/g) ?? []).join('\n');

  it('has aurora rules to check', () => {
    expect(auroraRules.length).toBeGreaterThan(0);
  });

  it('does not blur the drifting layers', () => {
    // A CSS blur forces re-rasterization whenever the layer's size or scale
    // changes. A radial-gradient gives the same soft edge for free.
    expect(auroraRules).not.toMatch(/filter:\s*blur/);
  });

  it('uses a gradient for the soft edge', () => {
    expect(auroraRules).toMatch(/radial-gradient/);
  });

  it('never animates scale on the ambient layers', () => {
    // Scaling is what triggered the re-raster. Translation is composited.
    const keyframes = css.match(/@keyframes gc-aurora-[a-c][^}]*\}[^}]*\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) expect(k).not.toMatch(/scale\(/);
  });
});
