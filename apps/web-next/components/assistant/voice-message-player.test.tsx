import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceMessagePlayer } from './voice-message-player';
import { AssistantLocaleProvider } from './locale-provider';

function renderPlayer(chunks: string[]) {
  return render(
    <AssistantLocaleProvider initialLocale="en">
      <VoiceMessagePlayer chunks={chunks} />
    </AssistantLocaleProvider>,
  );
}

describe('VoiceMessagePlayer', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('shows a pause control once mounted, since it autoplays', () => {
    renderPlayer(['AA==']);
    expect(screen.getByRole('button', { name: 'Pause voice message' })).toBeInTheDocument();
  });

  it('switches to a play control after being clicked', () => {
    renderPlayer(['AA==']);

    fireEvent.click(screen.getByRole('button', { name: 'Pause voice message' }));

    expect(screen.getByRole('button', { name: 'Play voice message' })).toBeInTheDocument();
  });
});
