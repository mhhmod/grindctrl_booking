'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceMessagePlayerStatus = 'idle' | 'playing' | 'paused' | 'done';

interface VoiceMessagePlayerState {
  status: VoiceMessagePlayerStatus;
  elapsedSeconds: number;
  totalSeconds: number;
  toggle: () => void;
  seek: (targetSeconds: number) => void;
}

/** Plays a sequence of base64 WAV chunks (Groq's Orpheus TTS is chunked at
 *  sentence boundaries — see lib/assistant/tts-chunker.ts) back to back as
 *  one logical "voice message," rather than concatenating the raw WAV bytes
 *  (which would need parsing and re-stitching WAV headers — real complexity
 *  for something that already plays seamlessly as a chained sequence).
 *  Autoplays once on mount, matching the behavior this replaces. */
export function useVoiceMessagePlayer(chunks: string[]): VoiceMessagePlayerState {
  // Base64 cannot contain '|': this key is stable across equivalent arrays.
  const chunksKey = chunks.join('|');
  const [loadedChunksKey, setLoadedChunksKey] = useState(chunksKey);
  const [status, setStatus] = useState<VoiceMessagePlayerStatus>(chunksKey ? 'playing' : 'idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const audiosRef = useRef<HTMLAudioElement[]>([]);
  const durationsRef = useRef<number[]>([]);
  const indexRef = useRef(0);

  if (loadedChunksKey !== chunksKey) {
    setLoadedChunksKey(chunksKey);
    setStatus(chunksKey ? 'playing' : 'idle');
    setElapsedSeconds(0);
    setTotalSeconds(0);
  }

  useEffect(() => {
    if (!chunksKey) return;

    const audios = chunksKey.split('|').map((base64) => new Audio(`data:audio/wav;base64,${base64}`));
    const durations = new Array<number>(audios.length).fill(0);
    let disposed = false;
    audiosRef.current = audios;
    durationsRef.current = durations;
    indexRef.current = 0;

    const priorElapsed = (index: number) => durations.slice(0, index).reduce((sum, d) => sum + d, 0);

    const playFrom = (index: number) => {
      if (disposed) return;
      if (index >= audios.length) {
        setStatus('done');
        return;
      }
      indexRef.current = index;
      audios[index].play().catch(() => { if (!disposed) setStatus('done'); });
    };

    const removeListeners = audios.map((audio, index) => {
      const onMetadata = () => {
        if (disposed) return;
        durations[index] = audio.duration || 0;
        setTotalSeconds(durations.reduce((sum, d) => sum + d, 0));
      };
      const onTimeUpdate = () => {
        if (!disposed) setElapsedSeconds(priorElapsed(index) + audio.currentTime);
      };
      const onEnded = () => playFrom(index + 1);
      audio.addEventListener('loadedmetadata', onMetadata);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('loadedmetadata', onMetadata);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
      };
    });

    playFrom(0);

    return () => {
      disposed = true;
      removeListeners.forEach((remove) => remove());
      audios.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audiosRef.current = [];
      durationsRef.current = [];
      indexRef.current = 0;
    };
  }, [chunksKey]);

  const toggle = useCallback(() => {
    const audios = audiosRef.current;
    if (audios.length === 0) return;

    if (status === 'playing') {
      audios[indexRef.current]?.pause();
      setStatus('paused');
      return;
    }

    if (status === 'done') {
      setElapsedSeconds(0);
      indexRef.current = 0;
    }
    setStatus('playing');
    audios[indexRef.current]?.play().catch(() => {
      if (audiosRef.current === audios) setStatus('done');
    });
  }, [status]);

  // Maps an absolute target position back to (chunk index, offset within that
  // chunk) — the chained-chunk equivalent of setting `audio.currentTime`.
  // Paused stays paused (only the position moves); playing/done resume
  // playback from the new spot, since a `done` player is only reachable by
  // dragging backward off the end.
  const seek = useCallback(
    (targetSeconds: number) => {
      const audios = audiosRef.current;
      const durations = durationsRef.current;
      if (audios.length === 0) return;

      const total = durations.reduce((sum, d) => sum + d, 0);
      const clamped = Math.max(0, Math.min(targetSeconds, total));

      let remaining = clamped;
      let targetIndex = durations.length - 1;
      for (let i = 0; i < durations.length; i++) {
        if (remaining < durations[i] || i === durations.length - 1) {
          targetIndex = i;
          break;
        }
        remaining -= durations[i];
      }

      audios[indexRef.current]?.pause();
      indexRef.current = targetIndex;
      audios[targetIndex].currentTime = remaining;
      setElapsedSeconds(clamped);

      if (status !== 'paused') {
        setStatus('playing');
        audios[targetIndex].play().catch(() => {
          if (audiosRef.current === audios) setStatus('done');
        });
      }
    },
    [status],
  );

  return { status, elapsedSeconds, totalSeconds, toggle, seek };
}
