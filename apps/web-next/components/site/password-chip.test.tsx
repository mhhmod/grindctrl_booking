import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyStorePassword, PasswordChip, STORE_PASSWORD } from './password-chip';

const COPY = {
  label: 'Store password',
  copy: 'Copy',
  copied: 'Copied',
  selected: 'Selected, press Ctrl+C',
  copyAria: 'Copy the store password',
  copiedAria: 'Store password copied',
};

function valueNode() {
  const span = document.createElement('span');
  span.textContent = STORE_PASSWORD;
  document.body.appendChild(span);
  return span;
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  document.body.innerHTML = '';
});

describe('copyStorePassword', () => {
  it('uses the clipboard when the page may', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyStorePassword(valueNode())).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('1');
  });

  it('falls back to selecting the value and execCommand when the clipboard is refused', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    await expect(copyStorePassword(valueNode())).resolves.toBe('copied');
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('leaves the value selected when nothing can copy, so Ctrl+C finishes the job', async () => {
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true });
    const node = valueNode();
    await expect(copyStorePassword(node)).resolves.toBe('selected');
    expect(window.getSelection()?.toString()).toBe(STORE_PASSWORD);
  });
});

describe('PasswordChip', () => {
  it('shows the password and says what happened after a press', async () => {
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true });
    render(<PasswordChip copy={COPY} />);
    expect(screen.getByText(STORE_PASSWORD)).toHaveAttribute('lang', 'en');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: COPY.copyAria }));
    });
    expect(screen.getByRole('button', { name: COPY.copyAria })).toHaveTextContent(COPY.selected);
    expect(screen.getByRole('status')).toHaveTextContent(COPY.selected);
  });
});
