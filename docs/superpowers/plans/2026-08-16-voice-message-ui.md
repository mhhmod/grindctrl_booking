# Voice Message Player + Voice Language Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace silent, fire-and-forget TTS autoplay with a real voice-message player control inside the assistant's chat bubble, and add a small hover/tap popover letting the visitor pick which language (English/Arabic) the assistant's voice speaks in, independent of the site's text language.

**Architecture:** Audio chunks (base64 WAV, already sentence-chunked server-side) get attached to their specific `DisplayMessage` instead of being played immediately in `chat-window.tsx`. A new self-contained `VoiceMessagePlayer` component (backed by a `useVoiceMessagePlayer` hook that owns a chain of `HTMLAudioElement`s) renders inside that message's bubble and owns its own play/pause/elapsed-time state. A new `VoiceLanguagePicker`, visible only when voice-reply is on, sets an override that `chat-window.tsx` passes to `streamTts` instead of the site locale.

**Tech Stack:** Next.js 15 / React 19, TypeScript, Tailwind, `radix-ui` (new `Popover` wrapper following the existing `sheet.tsx` pattern), Vitest + Testing Library (`fireEvent`, no `user-event` — matches this codebase's existing convention).

Approved spec: `docs/superpowers/specs/2026-08-16-voice-message-ui-design.md`

---

### Task 1: Add the Popover UI primitive

No test for this file — matches the existing precedent in this codebase, where thin Radix wrapper primitives (`components/ui/sheet.tsx`) have no dedicated test file; only the components that use them are tested.

**Files:**
- Create: `apps/web-next/components/ui/popover.tsx`

- [ ] **Step 1: Create the popover wrapper**

```tsx
"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
```

This mirrors `components/ui/sheet.tsx`'s exact structure (`data-slot` attributes, `data-open`/`data-closed` animation classes, `cn` merging) so it reads as the same family of primitive.

- [ ] **Step 2: Commit**

```bash
git add apps/web-next/components/ui/popover.tsx
git commit -m "feat: add Popover UI primitive (radix-ui wrapper, matches sheet.tsx pattern)"
```

---

### Task 2: Add the new i18n keys

**Files:**
- Modify: `apps/web-next/lib/assistant/i18n.ts`

- [ ] **Step 1: Add the five new keys to the `AssistantDict` interface**

In `apps/web-next/lib/assistant/i18n.ts`, add after `voiceReplyUnavailable: string;` (inside the `providerErrorTitle` / `providerErrorBody` / `retry` / `voiceReplyUnavailable` group):

```ts
  playVoiceMessage: string;
  pauseVoiceMessage: string;
  voiceLanguagePickerLabel: string;
  /** Self-demonyms — always "English" / "العربية" regardless of the
   *  surrounding UI language, same as how a language picker labels its own
   *  options in every language app. Still routed through i18n.ts (not
   *  hardcoded in the component) so every user-facing string stays
   *  discoverable in one place. */
  voiceLanguageEnglish: string;
  voiceLanguageArabic: string;
```

- [ ] **Step 2: Add the English values**

In the `en` object, after the `voiceReplyUnavailable` line, add:

```ts
  playVoiceMessage: 'Play voice message',
  pauseVoiceMessage: 'Pause voice message',
  voiceLanguagePickerLabel: 'Choose voice language',
  voiceLanguageEnglish: 'English',
  voiceLanguageArabic: 'العربية',
```

- [ ] **Step 3: Add the Arabic values**

In the `ar` object, after the `voiceReplyUnavailable` line, add:

```ts
  playVoiceMessage: 'تشغيل الرسالة الصوتية',
  pauseVoiceMessage: 'إيقاف الرسالة الصوتية',
  voiceLanguagePickerLabel: 'اختيار لغة الصوت',
  voiceLanguageEnglish: 'English',
  voiceLanguageArabic: 'العربية',
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web-next && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (the 3 pre-existing unrelated errors in `install-page-content.test.tsx` are fine).

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/lib/assistant/i18n.ts
git commit -m "feat: add i18n keys for the voice player and voice-language picker"
```

---

### Task 3: Attach audio to a specific message in `useAssistantChat`

**Files:**
- Modify: `apps/web-next/components/assistant/use-assistant-chat.ts`
- Test: `apps/web-next/components/assistant/use-assistant-chat.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the existing test `'calls onAssistantReply with the full assembled text once streaming completes'` in `use-assistant-chat.test.ts` with:

```ts
  it('calls onAssistantReply with the full assembled text and the message id once streaming completes', async () => {
    const client = makeClient();
    const onAssistantReply = vi.fn();
    const { result } = renderHook(() => useAssistantChat(client, onAssistantReply));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    const assistantId = result.current.messages[1].id;
    expect(onAssistantReply).toHaveBeenCalledWith('Hi there!', assistantId);
  });

  it('attaches audio chunks to the matching message via setMessageAudio', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });
    const assistantId = result.current.messages[1].id;

    act(() => {
      result.current.setMessageAudio(assistantId, ['AA==', 'BB==']);
    });

    expect(result.current.messages[1].audio).toEqual({ chunks: ['AA==', 'BB=='] });
    expect(result.current.messages[0].audio).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web-next && npx vitest run components/assistant/use-assistant-chat.test.ts`
Expected: FAIL — `onAssistantReply` called with only one argument, and `setMessageAudio` is not a function.

- [ ] **Step 3: Implement**

In `apps/web-next/components/assistant/use-assistant-chat.ts`:

Change the `DisplayMessage` interface:

```ts
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audio?: { chunks: string[] };
}
```

Change the hook's signature:

```ts
export function useAssistantChat(client: AssistantClient, onAssistantReply?: (text: string, messageId: string) => void) {
```

Change the `onAssistantReply` call site inside `sendText` (currently `onAssistantReply?.(fullReply.trim());`):

```ts
      } else if (fullReply.trim()) {
        onAssistantReply?.(fullReply.trim(), assistantId);
      }
```

Add a new setter, after `setVoiceError` is declared:

```ts
  const setMessageAudio = useCallback((messageId: string, chunks: string[]) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, audio: { chunks } } : m)));
  }, []);
```

Add `setMessageAudio` to the returned object, after `setVoiceError`:

```ts
    voiceError,
    setVoiceError,
    /** Attaches TTS audio to the specific message it was synthesized for —
     *  playback now lives inside VoiceMessagePlayer, keyed off this, rather
     *  than being played fire-and-forget from chat-window.tsx. */
    setMessageAudio,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web-next && npx vitest run components/assistant/use-assistant-chat.test.ts`
Expected: PASS (all tests, including the two new/changed ones)

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/components/assistant/use-assistant-chat.ts apps/web-next/components/assistant/use-assistant-chat.test.ts
git commit -m "feat: attach TTS audio to its message instead of playing it fire-and-forget"
```

---

### Task 4: `useVoiceMessagePlayer` hook

**Files:**
- Create: `apps/web-next/components/assistant/use-voice-message-player.ts`
- Test: `apps/web-next/components/assistant/use-voice-message-player.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web-next && npx vitest run components/assistant/use-voice-message-player.test.ts`
Expected: FAIL — module `./use-voice-message-player` does not exist yet.

- [ ] **Step 3: Implement**

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceMessagePlayerStatus = 'idle' | 'playing' | 'paused' | 'done';

interface VoiceMessagePlayerState {
  status: VoiceMessagePlayerStatus;
  elapsedSeconds: number;
  totalSeconds: number;
  toggle: () => void;
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
  }, [chunks]);

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

  return { status, elapsedSeconds, totalSeconds, toggle };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web-next && npx vitest run components/assistant/use-voice-message-player.test.ts`
Expected: PASS (5 tests)

**If it fails with `hasPointerCapture is not a function` or similar pointer-event errors:** that's unrelated to this hook (it doesn't touch pointer events) — stop and check you're running the right test file. **If it fails with `play is not a function`:** confirm the `beforeEach` mock is set before `renderHook` runs (Vitest hoists `describe`-scoped `beforeEach` automatically, so this should already be the case).

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/components/assistant/use-voice-message-player.ts apps/web-next/components/assistant/use-voice-message-player.test.ts
git commit -m "feat: add useVoiceMessagePlayer hook for chained chunk playback"
```

---

### Task 5: `VoiceMessagePlayer` component

**Files:**
- Create: `apps/web-next/components/assistant/voice-message-player.tsx`
- Test: `apps/web-next/components/assistant/voice-message-player.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web-next && npx vitest run components/assistant/voice-message-player.test.tsx`
Expected: FAIL — module `./voice-message-player` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
'use client';

import React from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMmSs } from '@/lib/assistant/i18n';
import { useAssistantLocale } from './locale-provider';
import { useVoiceMessagePlayer } from './use-voice-message-player';

interface VoiceMessagePlayerProps {
  chunks: string[];
}

/* Bar heights for the pulsing "equalizer" row — purely decorative, so a
   fixed pattern is enough; a real waveform would need decoding the audio
   into a canvas, which is real complexity for something decorative. */
const BAR_HEIGHTS = [6, 12, 8, 14, 5, 10, 7];

/** Renders inside an assistant message bubble once that message has audio
 *  attached (see use-assistant-chat.ts's setMessageAudio). The play icon
 *  intentionally never mirrors in RTL — like any media transport control,
 *  it represents playback direction (forward in time), not text direction. */
export function VoiceMessagePlayer({ chunks }: VoiceMessagePlayerProps) {
  const { t } = useAssistantLocale();
  const { status, elapsedSeconds, totalSeconds, toggle } = useVoiceMessagePlayer(chunks);
  const isPlaying = status === 'playing';
  const displaySeconds = status === 'playing' || status === 'paused' ? elapsedSeconds : totalSeconds;

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-foreground/10 pt-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? t.pauseVoiceMessage : t.playVoiceMessage}
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
      >
        {isPlaying ? (
          <Pause className="size-3" fill="currentColor" />
        ) : (
          <Play className="ms-0.5 size-3" fill="currentColor" style={{ transform: 'none' }} />
        )}
      </button>
      <div className="flex flex-1 items-end gap-0.5" aria-hidden="true">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            className={cn('w-[2.5px] rounded-full bg-current opacity-40', isPlaying && 'animate-pulse')}
            style={{ height, animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {formatMmSs(Math.round(displaySeconds))}
      </span>
    </div>
  );
}
```

Note the explicit `style={{ transform: 'none' }}` on the `Play` icon: some global RTL stylesheets auto-mirror icons by direction, and this one must never flip — see the comment above the component.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web-next && npx vitest run components/assistant/voice-message-player.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/components/assistant/voice-message-player.tsx apps/web-next/components/assistant/voice-message-player.test.tsx
git commit -m "feat: add VoiceMessagePlayer — play/pause, duration, no more silent autoplay"
```

---

### Task 6: `VoiceLanguagePicker` component

**Files:**
- Create: `apps/web-next/components/assistant/voice-language-picker.tsx`
- Test: `apps/web-next/components/assistant/voice-language-picker.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web-next && npx vitest run components/assistant/voice-language-picker.test.tsx`
Expected: FAIL — module `./voice-language-picker` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
'use client';

import React, { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AssistantLocale } from '@/lib/assistant/i18n';
import { useAssistantLocale } from './locale-provider';

interface VoiceLanguagePickerProps {
  value: AssistantLocale;
  onChange: (locale: AssistantLocale) => void;
}

const CLOSE_DELAY_MS = 200;

/** Only meaningful — and only rendered by the caller — while voice-reply is
 *  on. Opens on hover (desktop) or a click/tap (Radix's Popover default,
 *  which also covers touch — hover events never fire on touch devices, so
 *  the click path has to work on its own, not just as a hover fallback). */
export function VoiceLanguagePicker({ value, onChange }: VoiceLanguagePickerProps) {
  const { t } = useAssistantLocale();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const select = (locale: AssistantLocale) => {
    onChange(locale);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.voiceLanguagePickerLabel}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {value.toUpperCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent onMouseEnter={cancelClose} onMouseLeave={scheduleClose} className="flex min-w-28 flex-col">
        <button
          type="button"
          onClick={() => select('en')}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted',
            value === 'en' && 'font-semibold text-foreground',
          )}
        >
          {t.voiceLanguageEnglish}
        </button>
        <button
          type="button"
          onClick={() => select('ar')}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted',
            value === 'ar' && 'font-semibold text-foreground',
          )}
        >
          {t.voiceLanguageArabic}
        </button>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web-next && npx vitest run components/assistant/voice-language-picker.test.tsx`
Expected: PASS (4 tests)

**If a test fails with `target.hasPointerCapture is not a function` or `target.setPointerCapture is not a function`:** this is a known jsdom/Radix gap on some primitives. Add this polyfill to `apps/web-next/vitest.setup.ts`, right after the `ResizeObserver` block:

```ts
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
```

Then re-run the test. Only add this if the failure actually occurs — don't add it speculatively.

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/components/assistant/voice-language-picker.tsx apps/web-next/components/assistant/voice-language-picker.test.tsx
# If the polyfill above was needed:
# git add apps/web-next/vitest.setup.ts
git commit -m "feat: add VoiceLanguagePicker — hover/tap popover to pick the reply voice's language"
```

---

### Task 7: Wire it all into `chat-window.tsx`

**Files:**
- Modify: `apps/web-next/components/assistant/chat-window.tsx`

No new test file for this task — `chat-window.tsx` has never had a dedicated test in this codebase (it's verified live in the browser instead, per every prior task in this feature). This task's correctness gets verified in Task 9's live browser pass.

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { Send, X } from 'lucide-react';
```

with:

```tsx
import { Send, X } from 'lucide-react';
import { VoiceLanguagePicker } from './voice-language-picker';
import type { AssistantLocale } from '@/lib/assistant/i18n';
```

- [ ] **Step 2: Remove `playAudioChunksSequentially`**

Delete the entire function (lines 33-51 in the current file — the `function playAudioChunksSequentially(...)` block). Playback now lives inside `VoiceMessagePlayer`.

- [ ] **Step 3: Add `voiceLanguageOverride` state**

In the component body, after the existing `voiceOutputRef.current = voiceOutput;` line, add:

```tsx
  const [voiceLanguageOverride, setVoiceLanguageOverride] = useState<AssistantLocale | null>(null);
```

- [ ] **Step 4: Destructure `setMessageAudio` from the hook**

Change:

```tsx
  const {
    messages,
    status,
    budgets,
    rateLimited,
    providerError,
    sendText,
    refreshBudgets,
    setRateLimited,
    voiceError,
    setVoiceError,
  } = useAssistantChat(client, (text) => handleAssistantReplyRef.current(text));
```

to:

```tsx
  const {
    messages,
    status,
    budgets,
    rateLimited,
    providerError,
    sendText,
    refreshBudgets,
    setRateLimited,
    voiceError,
    setVoiceError,
    setMessageAudio,
  } = useAssistantChat(client, (text, messageId) => handleAssistantReplyRef.current(text, messageId));
```

- [ ] **Step 5: Rewrite `handleAssistantReply`**

Replace the whole `handleAssistantReply` callback with:

```tsx
  const handleAssistantReply = useCallback(
    async (text: string, messageId: string) => {
      // Cleared unconditionally, not after the voiceOutput check below — a
      // stale error from a prior voice-on turn must not keep showing once
      // the visitor has switched voice output back off.
      setVoiceError(null);
      if (!voiceOutputRef.current) return;
      const chunks: string[] = [];
      const result = await client.streamTts(
        text,
        (audioBase64) => {
          chunks.push(audioBase64);
        },
        voiceLanguageOverride ?? locale,
      );
      refreshBudgets();

      if (!result.ok) {
        if (result.kind === 'rate_limited') setRateLimited(result.info);
        // The chat reply already succeeded and is on screen as text — this
        // is the exact failure that used to go completely silent (mic just
        // idled with zero feedback), so it gets its own calm, accurate
        // message rather than reusing the alarming "AI unreachable" one.
        else setVoiceError(t.voiceReplyUnavailable);
        return;
      }

      // Playback itself now lives in VoiceMessagePlayer, keyed off this —
      // handleAssistantReply's job ends at getting the audio and attaching
      // it to the right message.
      setMessageAudio(messageId, chunks);
    },
    [client, refreshBudgets, setRateLimited, setVoiceError, setMessageAudio, voiceLanguageOverride, locale, t],
  );
```

This removes every `setMicState('speaking')` / `setMicState('idle')` call that used to live here — that mic-control "speaking" indicator was standing in for "audio is playing somewhere," which now has its own visible, explicit control in the message bubble. `MicControl`'s `speaking` state and styling stay defined (untouched) for its `idle | listening | processing | speaking | error` type; this component simply stops being the thing that triggers it.

- [ ] **Step 6: Update `handleMicClick`'s locale param — leave it as `locale`, not the override**

No code change needed here — confirm `client.transcribeAudio(blob, locale)` still passes plain `locale` (not `voiceLanguageOverride ?? locale`). This is deliberate: the voice-language picker controls which language the assistant *speaks* in, not what language Whisper expects the *visitor* to be speaking — those are independent. Leave this line exactly as it is.

- [ ] **Step 7: Render the picker in the header**

Change:

```tsx
        <div className="flex items-center gap-1.5">
          <ModeToggle
            voiceInput={voiceInput}
            voiceOutput={voiceOutput}
            onVoiceInputChange={setVoiceInput}
            onVoiceOutputChange={setVoiceOutput}
            disabled={status === 'sending' || effectiveMicState !== 'idle'}
          />
          {onClose && (
```

to:

```tsx
        <div className="flex items-center gap-1.5">
          <ModeToggle
            voiceInput={voiceInput}
            voiceOutput={voiceOutput}
            onVoiceInputChange={setVoiceInput}
            onVoiceOutputChange={setVoiceOutput}
            disabled={status === 'sending' || effectiveMicState !== 'idle'}
          />
          {voiceOutput && (
            <VoiceLanguagePicker value={voiceLanguageOverride ?? locale} onChange={setVoiceLanguageOverride} />
          )}
          {onClose && (
```

- [ ] **Step 8: Typecheck**

Run: `cd apps/web-next && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 9: Run the full assistant test suite**

Run: `cd apps/web-next && npx vitest run components/assistant lib/assistant app/api/assistant`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web-next/components/assistant/chat-window.tsx
git commit -m "feat: wire the voice player and language picker into ChatWindow"
```

---

### Task 8: Render the player inside the message bubble

**Files:**
- Modify: `apps/web-next/components/assistant/message-list.tsx`

- [ ] **Step 1: Import `VoiceMessagePlayer`**

Add to the imports:

```tsx
import { VoiceMessagePlayer } from './voice-message-player';
```

- [ ] **Step 2: Render it inside the assistant bubble, after the text**

Change:

```tsx
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
              message.role === 'user'
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-muted text-foreground',
            )}
          >
            {message.content || ' '}
          </div>
```

to:

```tsx
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
              message.role === 'user'
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-muted text-foreground',
            )}
          >
            {message.content || ' '}
            {message.audio && <VoiceMessagePlayer chunks={message.audio.chunks} />}
          </div>
```

`message.audio` only exists on assistant messages (only `setMessageAudio` sets it, and that's only ever called for the assistant reply's id), so no explicit role check is needed here.

- [ ] **Step 3: Run the message-list-adjacent test suite**

Run: `cd apps/web-next && npx vitest run components/assistant`
Expected: all pass (no existing message-list test asserts on the exact bubble children count in a way this would break — confirm by reading the output; if something did assert an exact child count, update it to account for the conditional player).

- [ ] **Step 4: Commit**

```bash
git add apps/web-next/components/assistant/message-list.tsx
git commit -m "feat: render the voice message player inside the assistant's bubble"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd apps/web-next && npx vitest run`
Expected: all pass, no regressions in unrelated suites.

- [ ] **Step 2: Full typecheck**

Run: `cd apps/web-next && npx tsc --noEmit -p tsconfig.json`
Expected: only the 3 pre-existing, unrelated errors in `install-page-content.test.tsx`.

- [ ] **Step 3: Live browser verification — English**

Start the dev server preview, open `/assistant`, switch voice-reply on, send a message. Confirm:
- The reply bubble shows a play/pause control with a duration that counts (not stuck at `0:00`).
- Clicking it pauses; clicking again resumes from where it left off, not from the start.
- The picker badge next to the mode toggle reads `EN` and does not appear when voice-reply is off.
- Hovering the picker badge opens the two-item list; clicking "العربية" switches the badge to `AR`.

- [ ] **Step 4: Live browser verification — Arabic voice, real audio**

With the picker set to `AR` (from Step 3) and voice-reply still on, send another message. Confirm:
- The reply's `streamTts` call now goes out with the Arabic locale regardless of the page's own text language (check the Network tab request body for `"locale":"ar"`).
- Real audio plays (not silence, not an error banner).

- [ ] **Step 5: Live browser verification — mobile tap**

Resize to a mobile width (375px). Confirm:
- The picker badge opens the language list on tap (not just hover, which doesn't exist here).
- The voice player's play/pause button and duration label don't overflow or wrap awkwardly inside the narrower bubble.

- [ ] **Step 6: Final commit (only if any fixes were needed in Steps 1-5)**

```bash
git add -A apps/web-next
git commit -m "fix: address issues found in live verification of the voice player/picker"
```
