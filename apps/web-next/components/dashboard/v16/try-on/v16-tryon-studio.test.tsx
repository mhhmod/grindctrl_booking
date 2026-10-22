import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import { getTryOnStudioCopy } from '@/lib/dashboard/tryon-studio-copy';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import { V16TryOnStudio, type SaveTryOnSettings } from './v16-tryon-studio';

const SETTINGS: TryOnWidgetSettings = {
  buttonLabel: 'Try it on',
  buttonLabelAr: null,
  accentBg: '#111111',
  accentFg: '#ffffff',
  radiusPx: 12,
  widgetTheme: 'light',
  iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e',
  loadingStyle: 'steps',
  catalogLabel: 'Try on',
  catalogLabelAr: null,
  catalogIconPx: 14,
  catalogFontPx: 12,
  catalogPadPx: 6,
  buttonIconPx: 28,
  showDownload: true,
  showWhatsapp: true,
  showAddToCart: true,
  showTryAgain: true,
  disclaimerText: null,
  disclaimerTextAr: null,
  loadingSteps: null,
};

const en = getTryOnStudioCopy('en');

function draw(save: SaveTryOnSettings = vi.fn(async () => ({ ok: true as const })), locale: 'en' | 'ar' = 'en') {
  renderWithMantine(<V16TryOnStudio locale={locale} shop="maison-noor.myshopify.com" settings={SETTINGS} saveSettings={save} />);
  return save;
}

describe('V16TryOnStudio', () => {
  it('lays out the board’s cards on today’s settings', () => {
    draw();
    for (const name of [en.button, en.panel, en.onTheLook, en.privacy, en.preview]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: en.corners })).toHaveTextContent('12 px');
    expect(screen.getByRole('switch', { name: en.actions.showWhatsapp.label })).toBeChecked();
    expect(screen.getByRole('link', { name: en.moveInThemeEditor })).toHaveAttribute(
      'href',
      'https://admin.shopify.com/store/maison-noor/themes/current/editor?template=product',
    );
    // Nothing to save yet.
    expect(screen.queryByRole('region', { name: en.unsavedLabel })).not.toBeInTheDocument();
  });

  it('counts changes, discards them, and saves them through today’s action', async () => {
    const save = draw();
    fireEvent.click(screen.getByRole('button', { name: en.moreRound }));
    fireEvent.click(screen.getByRole('switch', { name: en.actions.showWhatsapp.label }));
    const bar = screen.getByRole('region', { name: en.unsavedLabel });
    expect(within(bar).getByRole('status')).toHaveTextContent('2 unsaved changes');

    fireEvent.click(within(bar).getByRole('button', { name: en.discard }));
    expect(screen.queryByRole('region', { name: en.unsavedLabel })).not.toBeInTheDocument();
    // Focus stays in the studio, not at the page's start.
    await waitFor(() => expect(document.activeElement?.contains(screen.getByRole('heading', { level: 2, name: en.button }))).toBe(true));
    expect(screen.getByRole('group', { name: en.corners })).toHaveTextContent('12 px');

    fireEvent.change(screen.getByRole('textbox', { name: en.step(1) }), { target: { value: 'Reading your photo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.save }));
    });
    expect(save).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(save).mock.calls[0][0];
    expect(fd.get('shop')).toBe('maison-noor.myshopify.com');
    expect(fd.get('loading_steps')).toBe('Reading your photo');
    expect(fd.get('icon_bg_from')).toBe('#ff9a3d');
    expect(screen.getByRole('status')).toHaveTextContent(en.saved);
    await waitFor(() => expect(screen.getByRole('region', { name: en.unsavedLabel })).toHaveFocus());
  });

  it('says why a save failed, and keeps the changes', async () => {
    draw(vi.fn(async () => ({ ok: false as const, code: 'rate_limited' as const, message: 'slow down', retryAfterSeconds: 20 })));
    fireEvent.click(screen.getByRole('button', { name: en.lessRound }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.save }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(getTryOnDashboardCopy('en').actionRateLimited(20));
    expect(screen.getByRole('status')).toHaveTextContent('1 unsaved change');
  });

  it('needs the English labels before it saves', () => {
    draw();
    const legend = screen.getByRole('group', { name: en.productButton });
    fireEvent.change(within(legend).getByRole('textbox', { name: /English/ }), { target: { value: '' } });
    expect(within(legend).getByText(en.englishNeeded)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.save })).toBeDisabled();
  });

  it('opens the photo step in the preview from See what they see', async () => {
    draw();
    fireEvent.click(screen.getByRole('button', { name: en.seeWhatTheySee }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: getSettingsFormCopy('en').previewTabUpload })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('speaks Arabic in Arabic', () => {
    draw(undefined, 'ar');
    const ar = getTryOnStudioCopy('ar');
    expect(screen.getByRole('heading', { level: 2, name: ar.button })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: ar.actions.showAddToCart.label })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: ar.moreRound }));
    expect(screen.getByRole('status')).toHaveTextContent('تغيير واحد غير محفوظ');
  });
});
