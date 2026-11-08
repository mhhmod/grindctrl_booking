import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';
import { WidgetPreview, type WidgetPreviewSettings } from './widget-preview';

const base: WidgetPreviewSettings = {
  buttonLabel: 'Try it on with AI', accentBg: '#eb7805', accentFg: '#ffffff', radiusPx: 4, widgetTheme: 'light',
  iconBgFrom: '#000000', iconBgTo: '#000000', catalogLabel: 'Try on', catalogIconPx: 16, catalogFontPx: 13, catalogPadPx: 6,
  buttonIconPx: 18, loadingStyle: 'steps', loadingSteps: null, showDownload: true, showWhatsapp: true, showAddToCart: true,
  showTryAgain: true, disclaimerText: null,
};
const copy = getSettingsFormCopy('en');

/* The preview must draw the corners the store draws (lib/try-on/appearance.ts). */
describe('the preview corners match the storefront', () => {
  it.each([[4, '4px'], [999, '999px'], [0, '0px']])('draws the button and the card pill at %ipx', (radiusPx, expected) => {
    const { unmount } = render(<WidgetPreview s={{ ...base, radiusPx }} copy={copy} tab="button" />);
    expect(screen.getByRole('button', { name: /Try it on with AI/ }).style.borderRadius).toBe(expected);
    unmount();
    render(<WidgetPreview s={{ ...base, radiusPx }} copy={copy} tab="catalog" />);
    for (const pill of screen.getAllByRole('button', { name: /Try on/ })) expect(pill.style.borderRadius).toBe(expected);
  });
});
