import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authFormStateCopy, getAuthCopy } from '@/lib/auth/auth-i18n';
import { AUTH_FORM_MIN_HEIGHT_CLASS, AUTH_FORM_SLOW_MS, AuthFormPlaceholder, AuthFormProblem } from './auth-form-states';

const copy = (locale: 'en' | 'ar') => authFormStateCopy(getAuthCopy(locale));

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthFormPlaceholder', () => {
  it('stands in for the form, named for screen readers, in the reserved box', () => {
    render(<AuthFormPlaceholder copy={copy('en')} />);
    const placeholder = screen.getByRole('status');
    expect(placeholder).toHaveAttribute('aria-busy', 'true');
    expect(placeholder).toHaveTextContent('Loading the form');
    expect(placeholder).toHaveClass(AUTH_FORM_MIN_HEIGHT_CLASS);
  });

  it.each(['en', 'ar'] as const)('says it is taking longer than usual after a bounded wait (%s), in the same box', (locale) => {
    vi.useFakeTimers();
    render(<AuthFormPlaceholder copy={copy(locale)} />);
    act(() => {
      vi.advanceTimersByTime(AUTH_FORM_SLOW_MS - 1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const problem = screen.getByRole('alert');
    expect(problem).toHaveTextContent(copy(locale).formSlowTitle);
    expect(problem).toHaveClass(AUTH_FORM_MIN_HEIGHT_CLASS);
    expect(screen.getByRole('button', { name: copy(locale).retry })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy(locale).contactSupport })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
  });
});

describe('AuthFormProblem', () => {
  it('retries when asked', () => {
    const onRetry = vi.fn();
    render(<AuthFormProblem copy={copy('en')} kind="failed" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The form didn’t load');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
