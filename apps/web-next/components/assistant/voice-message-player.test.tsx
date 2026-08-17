import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceMessagePlayer, VoiceReplyLoading } from './voice-message-player';
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

describe('VoiceMessagePlayer seeking', () => {
  let createdAudios: HTMLAudioElement[];
  const OriginalAudio = window.Audio;

  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    createdAudios = [];
    window.Audio = vi.fn((src?: string) => {
      const audio = new OriginalAudio(src);
      createdAudios.push(audio);
      return audio;
    }) as unknown as typeof Audio;
  });

  afterEach(() => {
    window.Audio = OriginalAudio;
    vi.restoreAllMocks();
  });

  it('disables the seek slider until duration is known, then seeks on change', () => {
    renderPlayer(['AA==']);

    const slider = screen.getByRole('slider', { name: 'Seek voice message' });
    expect(slider).toBeDisabled();

    act(() => {
      Object.defineProperty(createdAudios[0], 'duration', { value: 8, configurable: true });
      createdAudios[0].dispatchEvent(new Event('loadedmetadata'));
    });

    expect(slider).toBeEnabled();
    fireEvent.change(slider, { target: { value: '5' } });
    expect(createdAudios[0].currentTime).toBe(5);
  });
});

describe('VoiceReplyLoading', () => {
  it('shows a status announcing the voice reply is on its way', () => {
    render(
      <AssistantLocaleProvider initialLocale="en">
        <VoiceReplyLoading />
      </AssistantLocaleProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Preparing voice reply…');
  });
});
