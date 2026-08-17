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
  const [status, setStatus] = useState<VoiceMessagePlayerStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const audiosRef = useRef<HTMLAudioElement[]>([]);
  const durationsRef = useRef<number[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    if (chunks.length === 0) return;

    const audios = chunks.map((base64) => new Audio(`data:audio/wav;base64,${base64}`));
    audiosRef.current = audios;
    durationsRef.current = new Array(audios.length).fill(0);
    indexRef.current = 0;

    const priorElapsed = (index: number) => durationsRef.current.slice(0, index).reduce((sum, d) => sum + d, 0);

    audios.forEach((audio, index) => {
      audio.addEventListener('loadedmetadata', () => {
        durationsRef.current[index] = audio.duration || 0;
        setTotalSeconds(durationsRef.current.reduce((sum, d) => sum + d, 0));
      });
      audio.addEventListener('timeupdate', () => {
        setElapsedSeconds(priorElapsed(index) + audio.currentTime);
      });
    });

    const playFrom = (index: number) => {
      if (index >= audios.length) {
        setStatus('done');
        return;
      }
      indexRef.current = index;
      audios[index].play().catch(() => setStatus('done'));
    };

    audios.forEach((audio, index) => {
      audio.addEventListener('ended', () => playFrom(index + 1));
    });

    setStatus('playing');
    playFrom(0);

    return () => {
      audios.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
    };
    // chunks is reduced to a content key (not the array reference) because the
    // effect's own setStatus() call triggers a re-render, and callers that build
    // `chunks` inline (e.g. `useVoiceMessagePlayer(['x'])`) pass a new array
    // instance each render — keying on identity would tear down and recreate
    // the audio elements every time playback starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks.join('|')]);

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
    audios[indexRef.current]?.play().catch(() => setStatus('done'));
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
        audios[targetIndex].play().catch(() => setStatus('done'));
      }
    },
    [status],
  );

  return { status, elapsedSeconds, totalSeconds, toggle, seek };
}
