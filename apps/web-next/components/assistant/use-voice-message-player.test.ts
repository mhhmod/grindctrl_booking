import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceMessagePlayer } from './use-voice-message-player';

describe('useVoiceMessagePlayer', () => {
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

  it('does nothing while there are no chunks yet', () => {
    const { result } = renderHook(() => useVoiceMessagePlayer([]));
    expect(result.current.status).toBe('idle');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('autoplays as soon as chunks arrive', () => {
    const { result } = renderHook(() => useVoiceMessagePlayer(['AA==']));
    expect(result.current.status).toBe('playing');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('pauses on toggle while playing, and resumes on toggle while paused', () => {
    const { result } = renderHook(() => useVoiceMessagePlayer(['AA==']));

    act(() => result.current.toggle());
    expect(result.current.status).toBe('paused');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);

    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('sums duration across chunks once their metadata loads', () => {
    const { result } = renderHook(() => useVoiceMessagePlayer(['AA==', 'BB==']));

    act(() => {
      Object.defineProperty(createdAudios[0], 'duration', { value: 3, configurable: true });
      createdAudios[0].dispatchEvent(new Event('loadedmetadata'));
      Object.defineProperty(createdAudios[1], 'duration', { value: 2, configurable: true });
      createdAudios[1].dispatchEvent(new Event('loadedmetadata'));
    });

    expect(result.current.totalSeconds).toBe(5);
  });

  it('advances to the next chunk when one ends, and reports done after the last', () => {
    const { result } = renderHook(() => useVoiceMessagePlayer(['AA==', 'BB==']));

    act(() => createdAudios[0].dispatchEvent(new Event('ended')));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('playing');

    act(() => createdAudios[1].dispatchEvent(new Event('ended')));
    expect(result.current.status).toBe('done');
  });
});
