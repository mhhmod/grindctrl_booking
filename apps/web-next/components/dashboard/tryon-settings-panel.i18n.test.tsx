import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The panel navigates on shop change, so it needs a router. Nothing here
   clicks the select; the stub only has to exist. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';

const c = getSettingsFormCopy('ar');

/* Text that is legitimately Latin inside an Arabic UI. Every entry needs a
   reason — an allowlist nobody justifies becomes a way to smuggle English in. */
const ALLOWED = [
  /^GRINDCTRL$/i, // brand mark, never translated
  /\.myshopify\.com$/, // shop identifiers
  /^[\d\s.,:%$+\-—/()]+$/, // numbers, units, punctuation
  /* Theme preset names. settings-copy.ts documents the decision: they are
     product names for a palette, and translating them makes them harder for a
     bilingual team to talk about, not easier. Listed by exact name rather than
     by shape, so this can never widen into "any English phrase in a button" —
     adding a seventh preset means editing this line on purpose. */
  /^(Minimal Black|Warm Cream|Bold Orange|Ocean Blue|Forest Green|Midnight)$/,
  /* Placeholder product names inside the catalog mock, and the widget label
     fallbacks. Each carries a ponytail: comment in widget-preview.tsx marking
     it a settled decision rather than an oversight. */
  /^(Catalog product|Another product)$/,
  /^(Try on|Try it on with AI)$/,
];

function isAllowed(text: string): boolean {
  return ALLOWED.some((pattern) => pattern.test(text.trim()));
}

/* The preview ships its keyframes in an inline <style>, whose contents are a
   text node the walker would otherwise read as copy. CSS is never shown to
   anyone, and the allowlist entry that would cover it (`animation`,
   `transform`, `opacity`, …) would be loose enough to swallow real English
   prose. So it is excluded from the walk rather than excused by a pattern. */
function latinOffenders(container: HTMLElement): string[] {
  const offenders: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('style, script')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim();
    if (!text || !/[A-Za-z]/.test(text)) continue;
    if (!isAllowed(text)) offenders.push(text);
  }

  return offenders;
}

/* Names the state in the failure. A gate that reports "Upload your photo"
   without saying which tab it was on costs the next person the same
   investigation all over again. */
function expectCleanIn(container: HTMLElement, state: string) {
  const offenders = latinOffenders(container);
  expect(offenders, `Untranslated text in Arabic UI [${state}]: ${offenders.join(' | ')}`)
    .toEqual([]);
}

/* Merchant-authored settings are DATABASE content, exactly like the plan and
   credit-pack names elsewhere on this page. Localizing database content is a
   separate approved piece of work (design doc 9a9a36b) and this fixture does
   NOT pretend it is solved — it supplies Arabic values so the gate measures
   only what the COMPONENT contributes. Feeding English here instead would
   force an allowlist entry broad enough to permit any English sentence, which
   is the one thing that would make this test worthless.

   selectedShop stays on the global-defaults row for the same reason: with a
   shop selected, the help line interpolates the merchant's domain into the
   middle of an Arabic sentence, and no regex can tell that text node apart
   from smuggled English. */
function arabicFixtureProps(overrides: Partial<TryOnWidgetSettings> = {}) {
  const settings: TryOnWidgetSettings = {
    buttonLabel: 'جرّبها بالذكاء الاصطناعي',
    buttonLabelAr: 'جرّبها بالذكاء الاصطناعي',
    accentBg: '#121212',
    accentFg: '#ffffff',
    radiusPx: 4,
    widgetTheme: 'light',
    iconBgFrom: '#3a3a3a',
    iconBgTo: '#6b6b6b',
    loadingStyle: 'steps',
    catalogLabel: 'جرّب',
    catalogLabelAr: 'جرّب',
    catalogIconPx: 14,
    catalogFontPx: 12,
    catalogPadPx: 6,
    buttonIconPx: 24,
    showDownload: true,
    showWhatsapp: true,
    showAddToCart: true,
    showTryAgain: true,
    disclaimerText: 'هذه المعاينة إرشادية بصريًا فقط.',
    disclaimerTextAr: 'هذه المعاينة إرشادية بصريًا فقط.',
    loadingSteps: ['نقرأ صورتك', 'نضبط المقاس', 'نجهّز النتيجة'],
    ...overrides,
  };

  return {
    shops: [{ domain: 'grindctrl.myshopify.com', status: 'installed' as const, jobCount: 3 }],
    selectedShop: 'default',
    settings,
    locale: 'ar' as const,
  };
}

/* Every preview tab, because a single render only ever walks the collapsed
   button tab — roughly a fifth of what the panel can show. The English this
   test was built to catch was hiding behind the other four. */
const TABS = [
  ['button', c.previewTabButton],
  ['catalog', c.previewTabCatalog],
  ['upload', c.previewTabUpload],
  ['generating', c.previewTabGenerating],
  ['results', c.previewTabResults],
] as const;

describe('TryOnSettingsPanel in Arabic', () => {
  it.each(TABS)('renders no un-allowlisted Latin text on the %s tab', (id, label) => {
    const { container } = render(<TryOnSettingsPanel {...arabicFixtureProps()} />);

    fireEvent.click(screen.getByRole('tab', { name: label }));
    expectCleanIn(container, `${id} tab`);
  });

  /* The journey mock is behind a toggle that starts closed, so nothing inside
     it was ever walked. */
  it('renders no un-allowlisted Latin text with the journey expanded', () => {
    const { container } = render(<TryOnSettingsPanel {...arabicFixtureProps()} />);

    fireEvent.click(screen.getByRole('tab', { name: c.previewTabButton }));
    fireEvent.click(container.querySelector('[aria-expanded="false"]') as HTMLElement);

    expectCleanIn(container, 'button tab, journey expanded');
  });

  it('renders no un-allowlisted Latin text in the catalog dialog', () => {
    const { container } = render(<TryOnSettingsPanel {...arabicFixtureProps()} />);

    fireEvent.click(screen.getByRole('tab', { name: c.previewTabCatalog }));

    /* The catalog pill carries the merchant's own label, which the fixture sets
       to 'جرّب'. Scoped to the tab panel because the same label also appears in
       the settings form above. */
    const panel = within(screen.getByRole('tabpanel'));
    fireEvent.click(panel.getAllByText('جرّب')[0]);

    expectCleanIn(container, 'catalog dialog');
  });

  /* The default loading steps only render when the merchant has written none
     of their own, so the fixture's Arabic steps hide them. This is the only
     state that exercises the built-in fallback an Arabic shopper actually
     reads when nothing is customised. */
  it('renders Arabic default loading steps when the merchant set none', () => {
    const { container } = render(
      <TryOnSettingsPanel {...arabicFixtureProps({ loadingSteps: null })} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: c.previewTabGenerating }));
    expectCleanIn(container, 'generating tab, default steps');
  });
});
