'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'error';
export type RecorderErrorReason = 'permission_denied' | 'unsupported';

/** Tap-to-toggle recording (start on one tap, stop on the next) rather than
 *  full voice-activity-detection — the brief's own research flags VAD's
 *  false-trigger/hangover-time tuning as real complexity, and recommends
 *  shipping a reliable push-to-talk-style fallback either way. This *is*
 *  that fallback, promoted to the default for v1; swapping in real VAD
 *  later only touches this hook, not anything that consumes it. */
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [levels, setLevels] = useState<number[]>([]);
  const [errorReason, setErrorReason] = useState<RecorderErrorReason | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    setErrorReason(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += Math.abs(value - 128);
        const level = Math.min(1, sum / data.length / 40);
        setLevels((prev) => [...prev.slice(-40), level]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');
    } catch (err) {
      setState('error');
      setErrorReason(err instanceof DOMException && err.name === 'NotAllowedError' ? 'permission_denied' : 'unsupported');
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        teardown();
        setLevels([]);
        setState('idle');
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, [teardown]);

  return { state, levels, errorReason, start, stop };
}
