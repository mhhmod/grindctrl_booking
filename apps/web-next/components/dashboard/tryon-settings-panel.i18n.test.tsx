import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The panel navigates on shop change, so it needs a router. Nothing here
   clicks the select; the stub only has to exist. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';

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
];

function isAllowed(text: string): boolean {
  return ALLOWED.some((pattern) => pattern.test(text.trim()));
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
function arabicFixtureProps() {
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
  };

  return {
    shops: [{ domain: 'grindctrl.myshopify.com', status: 'installed' as const, jobCount: 3 }],
    selectedShop: 'default',
    settings,
    locale: 'ar' as const,
  };
}

describe('TryOnSettingsPanel in Arabic', () => {
  it('renders no un-allowlisted Latin text', () => {
    const { container } = render(<TryOnSettingsPanel {...arabicFixtureProps()} />);

    const offenders: string[] = [];
    /* The preview ships its keyframes in an inline <style>, whose contents are
       a text node the walker would otherwise read as copy. CSS is never shown
       to anyone, and the allowlist entry that would cover it (`animation`,
       `transform`, `opacity`, …) would be loose enough to swallow real English
       prose. So it is excluded from the walk rather than excused by a pattern. */
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

    expect(offenders, `Untranslated text in Arabic UI: ${offenders.join(' | ')}`)
      .toEqual([]);
  });
});
