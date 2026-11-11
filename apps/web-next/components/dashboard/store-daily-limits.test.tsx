import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/app/dashboard/settings/spend-actions', () => ({ setStoreSpendLimit: mocks.save }));
import { StoreDailyLimits } from './store-daily-limits';
const rows = [{ key: 'tryOnDailyLooks' as const, override: null, defaultLimit: 300, limit: 300, used: 123 }];
beforeEach(() => { mocks.save.mockReset().mockResolvedValue({ ok: true }); });
describe('operator daily limit rows', () => {
 it.each(['en', 'ar'] as const)('labels the input and usage in %s and saves explicit zero', async locale => {
   const { container } = render(<StoreDailyLimits tenant="lulu.myshopify.com" rows={rows} locale={locale} />);
   const title = locale === 'ar' ? 'إطلالات القياس في اليوم' : 'Try-On looks per day';
   const input = screen.getByLabelText(title);
   expect(screen.getByText(locale === 'ar' ? '123 من 300 اليوم' : '123 of 300 today')).toBeInTheDocument();
   expect(container.querySelector('[dir]')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
   fireEvent.change(input, { target: { value: '0' } }); fireEvent.click(screen.getByRole('button', { name: (locale === 'ar' ? 'حفظ' : 'Save') + ': ' + title }));
   await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ tenant: 'lulu.myshopify.com', key: 'tryOnDailyLooks', value: 0 }));
   expect(await screen.findByRole('status')).toHaveTextContent(locale === 'ar' ? 'تم الحفظ' : 'Saved');
 });
 it('saves an empty value as inherit-default and shows errors without a false Saved state', async () => {
   mocks.save.mockResolvedValue({ ok: false });
   render(<StoreDailyLimits tenant="lulu.myshopify.com" rows={rows} locale="en" />);
   fireEvent.click(screen.getByRole('button', { name: 'Save: Try-On looks per day' }));
   expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save. Try again.");
   expect(mocks.save).toHaveBeenCalledWith({ tenant: 'lulu.myshopify.com', key: 'tryOnDailyLooks', value: null });
 });
});
