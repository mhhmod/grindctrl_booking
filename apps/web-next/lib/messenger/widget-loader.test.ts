import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* Both bugs covered here were invisible to every other kind of check: the file
   parses, ships, and runs, and the launcher simply ends up in the wrong place.
   They are asserted against the shipped asset because that is what a
   storefront actually loads. */

const loader = readFileSync(
  path.resolve(process.cwd(), 'public/widget/v1/messenger.js'),
  'utf8',
);

describe('storefront widget loader', () => {
  it('positions the launcher with :host(), which is the only selector that can cross the shadow boundary', () => {
    // `.pos-br` is a class on the HOST element, outside the shadow root, so a
    // descendant selector written inside the shadow stylesheet never matches.
    // The button then kept right/left:auto and hung ~36px off the screen edge
    // on every store — visible as a launcher clipped in half.
    expect(loader).toContain(':host(.pos-br) .btn{right:20px}');
    expect(loader).toContain(':host(.pos-bl) .btn{left:20px}');
    expect(loader).toContain(':host(.pos-br) .teaser{right:84px}');

    expect(loader).not.toMatch(/(^|[^(]);?\.pos-br \.btn\{/);
    expect(loader).not.toMatch(/(^|[^(]);?\.pos-bl \.btn\{/);
  });

  it('re-sizes the panel when the viewport changes instead of latching the first size', () => {
    // The panel used to be sized once, on first open, and never again: opening
    // it in a short preview pane left it full-bleed for the rest of the
    // session even on a wide desktop.
    expect(loader).toContain("addEventListener('resize'");
    expect(loader).toContain("addEventListener('orientationchange'");
  });

  it('decides the full-bleed layout on width alone', () => {
    // min(width,height) treated any short viewport — theme-editor preview,
    // short desktop window, landscape phone — as a small screen and covered
    // the whole page with the panel.
    expect(loader).toContain('window.innerWidth <= 560');
    expect(loader).not.toContain('Math.min(window.innerWidth, window.innerHeight)');
  });

  it('writes the panel style whole, so a re-size cannot inherit stale geometry', () => {
    // `cssText +=` left the full-bleed branch's inset:0 in place when it later
    // switched to the docked branch, which only sets bottom/right.
    expect(loader).toContain('frame.style.cssText = css');
    expect(loader).not.toContain("frame.style.cssText += ';inset:0");
  });
});
