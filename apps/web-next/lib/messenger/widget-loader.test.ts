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
    // The teaser's offset moved inline once it had to clear a resizable
    // launcher; the button's :host() rules are still the fix under test.

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

/* Two settings the dashboard has always offered and the loader never read.
   Both fail the same silent way: the control moves, the dashboard preview
   updates, the merchant publishes, and the storefront is unchanged. */
describe('storefront widget loader — settings it must actually honour', () => {
  it('sizes the launcher from the merchant setting, not a hardcoded 56', () => {
    expect(loader).toContain('appearance.launcherSizePx');
    expect(loader).toContain("btn.style.height = size + 'px'");

    // Everything anchored above the launcher has to move with it, or a 72px
    // button ends up underneath the panel it opened.
    expect(loader).toContain("(launcherSize() + 32)");
    expect(loader).toContain('launcherSize() + 28');
    expect(loader).not.toContain(':host(.pos-br) .teaser{right:84px}');
  });

  it('lets the merchant pin the widget language instead of following the browser', () => {
    expect(loader).toContain('appearance.languageMode');
    expect(loader).toContain('state.locale = resolveLocale(config)');
    // A data-locale on the script tag is a deliberate per-page override and
    // still outranks the stored setting.
    expect(loader).toMatch(/function resolveLocale[\s\S]{0,200}LOCALE_HINT/);
  });
});

/* The size fix shipped once and still did nothing. It set the height inline
   but gated the WIDTH on an `iconOnly` flag derived from launcherLabel — and
   most stores set a label, so the width kept coming from the `.btn.icon-only`
   class, which hardcodes 56px. The button is always icon-only in practice:
   its content is the SVG and the label is only ever an aria-label. */
describe('storefront widget loader — launcher geometry', () => {
  it('sizes both axes unconditionally, with no label-derived flag', () => {
    expect(loader).toContain("btn.style.height = size + 'px'");
    expect(loader).toContain("btn.style.width = size + 'px'");
    expect(loader).not.toContain('var iconOnly');
    expect(loader).not.toContain('if (iconOnly)');
  });

  it('reads the corner style the dashboard has always offered', () => {
    expect(loader).toContain('appearance.radiusStyle');
    expect(loader).toContain('btn.style.borderRadius = launcherRadius()');
    expect(loader).toContain("'border-radius:' + panelRadius()");
    expect(loader).not.toContain('border-radius:16px;overflow:hidden');
  });
});

/* On a phone the panel is full-bleed and covers the launcher — the only
   control that closed it. A shopper who opened the chat had no way back to
   the store short of reloading it. */
describe('storefront widget loader — closing and warm-up', () => {
  it('accepts a close request only from the panel window it created', () => {
    expect(loader).toContain("addEventListener('message'");
    expect(loader).toContain("grindctrl-messenger:close");
    // Identity, not an origin string: nothing else on the page can forge
    // being the window we made.
    expect(loader).toContain('event.source !== state.iframe.contentWindow');
  });

  it('builds the panel before the tap rather than during it', () => {
    expect(loader).toContain('function warmPanel()');
    expect(loader).toContain("btn.addEventListener('pointerenter', warmPanel)");
    expect(loader).toContain("btn.addEventListener('touchstart', warmPanel");
    expect(loader).toContain("btn.addEventListener('focus', warmPanel)");
  });

  it('does not spend a shopper\'s metered data on a panel they may never open', () => {
    expect(loader).toContain('saveData');
    expect(loader).toContain('effectiveType');
  });
});
