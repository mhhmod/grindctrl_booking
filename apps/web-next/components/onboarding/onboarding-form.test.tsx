import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/app/onboarding/actions', () => ({ submitOnboarding: mocks.submit }));

import { OnboardingForm } from './onboarding-form';
import { getAuthCopy } from '@/lib/auth/auth-i18n';

beforeEach(() => mocks.submit.mockReset().mockResolvedValue({ errors: {} }));

describe.each(['en', 'ar'] as const)('OnboardingForm in %s', (locale) => {
  const copy = getAuthCopy(locale);

  it('asks for the store details, with the required ones marked and the platform picker native', () => {
    render(<OnboardingForm profile={null} copy={copy} />);
    for (const label of [copy.fieldName, copy.fieldPhone, copy.fieldCompany, copy.fieldWebsite]) {
      expect(screen.getByRole('textbox', { name: new RegExp(label) })).toBeRequired();
    }
    expect(screen.getByLabelText(new RegExp(copy.fieldPlatform)).tagName).toBe('SELECT');
    expect(screen.getByLabelText(new RegExp(copy.fieldOrders)).tagName).toBe('SELECT');
    expect(screen.getByRole('button', { name: copy.submit })).toBeInTheDocument();
  });

  it('names the next step: connecting the store, or just Continue on the way elsewhere', () => {
    expect(copy.submit).toBe(locale === 'en' ? 'Continue to connect your store' : 'تابع لربط متجرك');
    render(<OnboardingForm profile={null} copy={copy} next="/claim?token=abc" />);
    expect(screen.getByRole('button', { name: copy.submitContinue })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.submit })).not.toBeInTheDocument();
  });

  it('shows what the server rejected and moves focus to the first rejected field', async () => {
    mocks.submit.mockResolvedValue({ errors: { phone: 'Enter a valid number' }, message: 'Check the form' });
    const { container } = render(<OnboardingForm profile={null} copy={copy} />);
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the form');
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('input[name="phone"]')).toHaveFocus());
  });
});

describe('OnboardingForm saved answers', () => {
  it('starts from the saved profile', () => {
    const copy = getAuthCopy('en');
    render(<OnboardingForm profile={{ fullName: 'Hana Adel', companyName: 'Maison Noor' } as never} copy={copy} />);
    expect(screen.getByRole('textbox', { name: new RegExp(copy.fieldName) })).toHaveValue('Hana Adel');
    expect(screen.getByRole('textbox', { name: new RegExp(copy.fieldCompany) })).toHaveValue('Maison Noor');
  });
});
