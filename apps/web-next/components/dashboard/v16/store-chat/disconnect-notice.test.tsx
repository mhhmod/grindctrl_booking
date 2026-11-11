import React from 'react';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { DisconnectNotice } from './disconnect-notice';
it.each(['en', 'ar'] as const)('M14: confirmation names what stays and provides the real reconnect path (%s)', (locale) => {
  renderWithMantine(<DisconnectNotice locale={locale} shop="merchant.myshopify.com" />);
  expect(screen.getByRole('status')).toHaveTextContent(locale === 'ar' ? 'الباقة' : 'your plan');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/try-on/setup?shop=merchant.myshopify.com#shopify-app');
});
