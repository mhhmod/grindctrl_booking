import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceLanguagePicker } from './voice-language-picker';
import { AssistantLocaleProvider } from './locale-provider';

function renderPicker(value: 'en' | 'ar', onChange = vi.fn()) {
  return render(
    <AssistantLocaleProvider initialLocale="en">
      <VoiceLanguagePicker value={value} onChange={onChange} />
    </AssistantLocaleProvider>,
  );
}

describe('VoiceLanguagePicker', () => {
  it('shows the active language as its two-letter code', () => {
    renderPicker('ar');
    expect(screen.getByRole('button', { name: 'Choose voice language' })).toHaveTextContent('AR');
  });

  it('opens the language list on hover', () => {
    renderPicker('en');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Choose voice language' }));

    expect(screen.getByText('العربية')).toBeInTheDocument();
  });

  it('opens the language list on click, for touch devices with no hover', () => {
    renderPicker('en');
    fireEvent.click(screen.getByRole('button', { name: 'Choose voice language' }));

    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('calls onChange and closes the list when a language is picked', () => {
    const onChange = vi.fn();
    renderPicker('en', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Choose voice language' }));

    fireEvent.click(screen.getByText('العربية'));

    expect(onChange).toHaveBeenCalledWith('ar');
    expect(screen.queryByText('العربية')).not.toBeInTheDocument();
  });
});
