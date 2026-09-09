import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTryOnSettingsAction } from '@/app/dashboard/try-on/actions';
import { TryOnSettingsPanel } from './tryon-settings-panel';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import type { MerchantActionFailure } from '@/lib/request-rate-limit';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/dashboard/try-on/actions', () => ({ saveTryOnSettingsAction: vi.fn() }));
// This suite tests the save boundary; the sibling i18n suite renders the
// full shared controls and all preview states without a mock.
vi.mock('@/components/try-on/settings-controls', () => ({
  TryOnSettingsControls: ({ value, onChange }: {
    value: TryOnWidgetSettings;
    onChange: <K extends keyof TryOnWidgetSettings>(key: K, value: TryOnWidgetSettings[K]) => void;
  }) => <input aria-label="Button label" value={value.buttonLabel} onChange={(event) => onChange('buttonLabel', event.target.value)} />,
}));

const settings: TryOnWidgetSettings = {
  buttonLabel: 'Try it on', buttonLabelAr: null, accentBg: '#121212', accentFg: '#ffffff',
  radiusPx: 4, widgetTheme: 'light', iconBgFrom: '#3a3a3a', iconBgTo: '#6b6b6b',
  loadingStyle: 'steps', catalogLabel: 'Try on', catalogLabelAr: null, catalogIconPx: 14,
  catalogFontPx: 12, catalogPadPx: 6, buttonIconPx: 24, showDownload: true,
  showWhatsapp: true, showAddToCart: true, showTryAgain: true, disclaimerText: null,
  disclaimerTextAr: null, loadingSteps: null,
};

function mount(locale: 'en' | 'ar') {
  return render(<TryOnSettingsPanel shops={[]} selectedShop="alpha.myshopify.com" settings={settings} locale={locale} />);
}

beforeEach(() => vi.resetAllMocks());

describe('TryOnSettingsPanel safe action results', () => {
  const cases = (['en', 'ar'] as const).flatMap((locale) =>
    (['rate_limited', 'unavailable', 'forbidden'] as const).map((code) => ({ locale, code })),
  );

  it.each(cases)('shows localized $code feedback in $locale and retains unsaved values', async ({ locale, code }) => {
    const failure: MerchantActionFailure = { ok: false, code, retryAfterSeconds: 17, message: 'INTERNAL_DATABASE_SECRET' };
    vi.mocked(saveTryOnSettingsAction).mockResolvedValue(failure);
    const c = getTryOnDashboardCopy(locale);
    mount(locale);
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Edited label' } });
    fireEvent.click(screen.getByRole('button', { name: c.saveSettings }));

    const expected = code === 'rate_limited' ? c.actionRateLimited(17)
      : code === 'unavailable' ? c.actionUnavailable(17) : c.actionForbidden;
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByLabelText('Button label')).toHaveValue('Edited label');
    expect(screen.getByRole('button', { name: c.saveSettings })).toBeEnabled();
    expect(screen.queryByText(c.savedLive)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(failure.message);
    expect(saveTryOnSettingsAction).toHaveBeenCalledTimes(1);
    const submitted = vi.mocked(saveTryOnSettingsAction).mock.calls[0][0];
    expect(submitted.get('shop')).toBe('alpha.myshopify.com');
    expect(submitted.get('button_label')).toBe('Edited label');
  });

  it('only announces a confirmed success', async () => {
    vi.mocked(saveTryOnSettingsAction).mockResolvedValue({ ok: true });
    const c = getTryOnDashboardCopy('en');
    mount('en');
    fireEvent.click(screen.getByRole('button', { name: c.saveSettings }));
    expect(await screen.findByRole('status')).toHaveTextContent(c.savedLive);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles an unexpected production action rejection without exposing details', async () => {
    vi.mocked(saveTryOnSettingsAction).mockRejectedValue(new Error('PRIVATE_DATABASE_URL'));
    const c = getTryOnDashboardCopy('en');
    mount('en');
    fireEvent.click(screen.getByRole('button', { name: c.saveSettings }));
    expect(await screen.findByRole('alert')).toHaveTextContent(c.saveFailed);
    expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_URL');
    expect(screen.getByRole('button', { name: c.saveSettings })).toBeEnabled();
  });
});
