import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MicControl } from './mic-control';
import { AssistantLocaleProvider } from './locale-provider';

function renderMic(state: 'idle' | 'listening' | 'processing' | 'speaking' | 'error', onClick = vi.fn()) {
  return render(
    <AssistantLocaleProvider initialLocale="en">
      <MicControl state={state} levels={[]} onClick={onClick} />
    </AssistantLocaleProvider>,
  );
}

describe('MicControl', () => {
  it('labels the idle state as tap to speak and is clickable', () => {
    const onClick = vi.fn();
    renderMic('idle', onClick);

    const button = screen.getByRole('button', { name: 'Tap to speak' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('gives every state a distinct accessible label', () => {
    const labels: Record<string, string> = {
      idle: 'Tap to speak',
      listening: 'Listening…',
      processing: 'Transcribing…',
      speaking: 'Speaking…',
      error: 'Something went wrong',
    };
    for (const [state, label] of Object.entries(labels)) {
      const { unmount } = renderMic(state as never);
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      unmount();
    }
  });

  it('disables the button while processing so a second recording cannot start mid-transcription', () => {
    renderMic('processing');
    expect(screen.getByRole('button', { name: 'Transcribing…' })).toBeDisabled();
  });
});
