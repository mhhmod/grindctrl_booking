import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { AssistantLauncher } from './launcher';
import { createMockAssistantClient } from '@/lib/assistant/mock-client';
import { LandingLocaleProvider, LandingLocaleToggle } from '@/components/landing/landing-locale';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';
import { getAssistantDictionary } from '@/lib/assistant/i18n';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/');
  document.cookie = 'gc-locale=;path=/;max-age=0';
});

afterEach(() => { document.cookie = 'gc-locale=;path=/;max-age=0'; });

function renderLauncher() {
  return render(<AssistantLauncher client={createMockAssistantClient()} initialLocale="en" />);
}

describe('AssistantLauncher', () => {
  it('follows the landing language toggle without remounting or a server refresh', () => {
    render(<>
      <LandingLocaleProvider initialLocale="en"><LandingLocaleToggle /></LandingLocaleProvider>
      <AssistantLauncher client={createMockAssistantClient()} initialLocale="en" />
    </>);
    const en = getAssistantDictionary('en');
    const ar = getAssistantDictionary('ar');
    expect(screen.getByRole('button', { name: en.launcherOpen })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: getLandingDictionary('en').langToggleLabel }));
    const arabicLauncher = screen.getByRole('button', { name: ar.launcherOpen });
    expect(arabicLauncher.closest('[lang]')).toHaveAttribute('lang', 'ar');
    expect(arabicLauncher.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    fireEvent.click(screen.getByRole('button', { name: getLandingDictionary('ar').langToggleLabel }));
    expect(screen.getByRole('button', { name: en.launcherOpen })).toBeInTheDocument();
  });

  it('shows the closed-state chat mark and motion layer, not the close icon', () => {
    renderLauncher();

    expect(screen.getByRole('button', { name: 'Open assistant' })).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-chat-mark')).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-dna-svg')).toBeInTheDocument();
  });

  it('swaps to the close icon and drops the motion layer once opened', () => {
    renderLauncher();

    fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));

    expect(screen.getByRole('dialog', { name: 'GrindCTRL AI' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: 'Close assistant' })).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-chat-mark')).not.toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-dna-svg')).not.toBeInTheDocument();
  });

  it.each(['Escape', 'Close'] as const)('returns keyboard focus to the launcher after %s', async (method) => {
    renderLauncher();
    const launcher = screen.getByRole('button', { name: 'Open assistant' });
    launcher.focus();
    fireEvent.click(launcher);
    const close = screen.getByRole('button', { name: 'Close assistant' });
    close.focus();
    expect(close).toHaveFocus();

    if (method === 'Escape') fireEvent.keyDown(close, { key: 'Escape', code: 'Escape' });
    else fireEvent.click(close);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open assistant' })).toHaveFocus());
  });

  it.each(['/sign-in', '/sign-up', '/sign-in/factor-two', '/dashboard/overview', '/embed/try-on'])(
    'does not mount on the protected interaction surface %s',
    (pathname) => {
      vi.mocked(usePathname).mockReturnValue(pathname);
      renderLauncher();
      expect(screen.queryByRole('button', { name: 'Open assistant' })).not.toBeInTheDocument();
    },
  );

  it('removes an open assistant during client navigation to auth and returns closed', () => {
    const client = createMockAssistantClient();
    const { rerender } = render(<AssistantLauncher client={client} initialLocale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    vi.mocked(usePathname).mockReturnValue('/sign-in');
    rerender(<AssistantLauncher client={client} initialLocale="en" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close assistant' })).not.toBeInTheDocument();

    vi.mocked(usePathname).mockReturnValue('/');
    rerender(<AssistantLauncher client={client} initialLocale="en" />);
    expect(screen.getByRole('button', { name: 'Open assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
