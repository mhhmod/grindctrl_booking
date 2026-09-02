import { describe, expect, it } from 'vitest';
import { isForeignScriptEvent } from './foreign-frames';

const framesEvent = (filenames: Array<string | undefined>) => ({
  exception: {
    values: [{ stacktrace: { frames: filenames.map((filename) => ({ filename })) } }],
  },
});

describe('isForeignScriptEvent', () => {
  it('flags the real browser-extension event that flooded Sentry', () => {
    // JAVASCRIPT-NEXTJS-M: 70 escalating events, frames entirely in an
    // injected extension bundle, reported as an unhandled rejection.
    expect(
      isForeignScriptEvent(framesEvent(['app:///executors/200.js', 'app:///executors/200.js'])),
    ).toBe(true);
  });

  it('flags extension-scheme frames', () => {
    expect(isForeignScriptEvent(framesEvent(['chrome-extension://abc/inject.js']))).toBe(true);
    expect(isForeignScriptEvent(framesEvent(['moz-extension://abc/inject.js']))).toBe(true);
  });

  it('keeps our own client chunks, however the host is rewritten', () => {
    expect(isForeignScriptEvent(framesEvent(['app:///_next/static/chunks/main-app-abc.js']))).toBe(
      false,
    );
    expect(
      isForeignScriptEvent(framesEvent(['https://grindctrl.cloud/_next/static/chunks/page.js'])),
    ).toBe(false);
  });

  it('keeps an event where only one frame is ours, so extension-wrapped app errors survive', () => {
    expect(
      isForeignScriptEvent(
        framesEvent(['app:///executors/200.js', 'app:///_next/static/chunks/page.js']),
      ),
    ).toBe(false);
  });

  it('keeps anything it cannot judge rather than risking a real error', () => {
    expect(isForeignScriptEvent({})).toBe(false);
    expect(isForeignScriptEvent({ exception: { values: [] } })).toBe(false);
    expect(isForeignScriptEvent(framesEvent([]))).toBe(false);
    expect(isForeignScriptEvent(framesEvent([undefined]))).toBe(true);
  });
});
