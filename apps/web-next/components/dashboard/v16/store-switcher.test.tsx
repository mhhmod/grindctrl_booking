import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { buildShellStores } from '@/lib/dashboard/shell-model';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import { StoreSwitcher } from './store-switcher';

describe('identifiable stores in the switcher', () => {
  it.each(['en', 'ar'] as const)('shows the fallback name and domain separately on phones and desktop (%s)', (locale) => {
    const stores = buildShellStores([], [
      { id: 'paste', name: 'My store', domain: null, storeDomain: 'harmong-eg.myshopify.com' },
      { id: 'web', name: 'Maison Noor', domain: 'maison.example' },
    ], { siteId: 'paste', shopDomain: null });
    for (const compact of [true, false]) {
      const { unmount } = render(<StoreSwitcher stores={stores} locale={locale} pathname="/dashboard/plan" compact={compact} />);
      fireEvent.click(screen.getByRole('button', { name: getShellCopy(locale).switchStore('harmong-eg') }));
      for (const store of stores) {
        const row = screen.getByRole('menuitem', { name: new RegExp(store.label) });
        expect(within(row).getByText(store.domain!)).toHaveAttribute('dir', 'ltr');
        expect(row).toHaveAttribute('href', `/dashboard/plan?site=${'site' in store.choice ? store.choice.site : ''}`);
      }
      expect(screen.queryByText('My store')).not.toBeInTheDocument();
      unmount();
    }
  });
});
