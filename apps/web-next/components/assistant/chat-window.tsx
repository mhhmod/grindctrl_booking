'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { VoiceLanguagePicker } from './voice-language-picker';
import type { AssistantLocale } from '@/lib/assistant/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssistantClient } from '@/lib/assistant/client';
import { createRealAssistantClient } from '@/lib/assistant/real-client';
import { useAssistantChat } from './use-assistant-chat';
import { useVoiceRecorder } from './use-voice-recorder';
import { MessageList } from './message-list';
import { MicControl, type MicState } from './mic-control';
import { ModeToggle } from './mode-toggle';
import { RateLimitBanner } from './rate-limit-banner';
import { useAssistantLocale } from './locale-provider';

interface ChatWindowProps {
  /** Defaults to a client-constructed real client (fetch against
   *  /api/assistant/*) — server components can't pass a function-bearing
   *  client object as a prop across the RSC boundary, so the default has
   *  to be built here, not upstream. Pass a mock (lib/assistant/mock-client)
   *  explicitly for demos/tests. */
  client?: AssistantClient;
  redirectPath?: string;
  className?: string;
  /** Only the launcher's overlay sheet needs its own close control — the
   *  standalone /assistant page has nothing to close back to. Rendering it
   *  inline in this header (instead of the Sheet's own absolutely-positioned
   *  X) is what keeps it from stacking on top of the mode toggle. */
  onClose?: () => void;
}

/** The unified window: text and voice share the same message history and
 *  the same two toggles (how you send, how you receive) — switching either
 *  mid-conversation never loses context, since both read/write the same
 *  useAssistantChat state. */
export function ChatWindow({ client: clientProp, redirectPath = '/assistant', className, onClose }: ChatWindowProps) {
  const { t, dir, locale } = useAssistantLocale();
  const defaultClient = useMemo(() => createRealAssistantClient(), []);
  const client = clientProp ?? defaultClient;
  const [voiceInput, setVoiceInput] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [micError, setMicError] = useState<string | undefined>(undefined);
  const voiceOutputRef = useRef(voiceOutput);
  voiceOutputRef.current = voiceOutput;
  const [voiceLanguageOverride, setVoiceLanguageOverride] = useState<AssistantLocale | null>(null);
  // Explicit override wins; otherwise the voice follows whichever language
  // the visitor already has the site in. Used both for the actual TTS call
  // and for what the picker itself displays as "currently selected."
  const effectiveVoiceLocale = voiceLanguageOverride ?? locale;

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
  const recorder = useVoiceRecorder();

  const handleAssistantReply = useCallback(
    async (text: string, messageId: string) => {
      // Cleared unconditionally, not after the voiceOutput check below — a
      // stale error from a prior voice-on turn must not keep showing once
      // the visitor has switched voice output back off.
      setVoiceError(null);
      if (!voiceOutputRef.current) return;
      // Marked pending before the TTS call even starts — the round-trip
      // (chunking + a real Groq call) reliably takes long enough that
      // showing nothing here read as "the reply is text-only," not "voice
      // is on its way."
      setMessageAudio(messageId, { status: 'pending' });
      const chunks: string[] = [];
      const result = await client.streamTts(
        text,
        (audioBase64) => {
          chunks.push(audioBase64);
        },
        effectiveVoiceLocale,
      );
      refreshBudgets();

      if (!result.ok) {
        if (result.kind === 'rate_limited') setRateLimited(result.info);
        // The chat reply already succeeded and is on screen as text — this
        // is the exact failure that used to go completely silent (mic just
        // idled with zero feedback), so it gets its own calm, accurate
        // message rather than reusing the alarming "AI unreachable" one.
        else setVoiceError(t.voiceReplyUnavailable);
        setMessageAudio(messageId, undefined);
        return;
      }

      // Playback itself now lives in VoiceMessagePlayer, keyed off this —
      // handleAssistantReply's job ends at getting the audio and attaching
      // it to the right message.
      setMessageAudio(messageId, { status: 'ready', chunks });
    },
    [client, refreshBudgets, setRateLimited, setVoiceError, setMessageAudio, effectiveVoiceLocale, t],
  );
  const handleAssistantReplyRef = useRef(handleAssistantReply);
  handleAssistantReplyRef.current = handleAssistantReply;

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    void sendText(inputValue);
    setInputValue('');
  }, [inputValue, sendText]);

  const handleMicClick = useCallback(async () => {
    if (recorder.state === 'idle') {
      setMicError(undefined);
      setMicState('listening');
      await recorder.start();
      return;
    }
    if (recorder.state === 'recording') {
      setMicState('processing');
      const blob = await recorder.stop();
      if (!blob) {
        setMicState('idle');
        return;
      }
      // Was plain `locale` (the site's text language) — but visitors read
      // the voice-language picker as "this is the language for talking to
      // it," not just what it speaks back. Confirmed live: picking AR
      // there while the site itself loaded in English still hinted
      // Whisper toward English, and a wrong hint measurably degrades
      // transcription rather than just doing nothing.
      const result = await client.transcribeAudio(blob, effectiveVoiceLocale);
      refreshBudgets();

      if (!result.ok) {
        if (result.kind === 'rate_limited') {
          setRateLimited(result.info);
          setMicState('idle');
          return;
        }
        setMicState('error');
        setMicError(result.kind === 'bad_input' ? t.badInputNoAudio : t.providerErrorTitle);
        window.setTimeout(() => setMicState('idle'), 2_500);
        return;
      }
      setMicState('idle');
      void sendText(result.transcript);
    }
  }, [recorder, client, sendText, t, refreshBudgets, setRateLimited, effectiveVoiceLocale]);

  // Reflect a genuine mic-permission failure as the error state.
  const effectiveMicState: MicState = recorder.state === 'error' && micState !== 'error' ? 'error' : micState;
  const effectiveMicError =
    recorder.state === 'error' ? (recorder.errorReason === 'permission_denied' ? t.micPermissionDenied : t.micError) : micError;

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void sendText(suggestion);
    },
    [sendText],
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm', className)} dir={dir}>
      {/* flex-wrap, not a hand-tuned narrow-viewport spacing budget: with
          voice-reply on, this row can hold 6 controls (2 toggle pairs +
          language picker + close) — at 320-360px that's more than the
          controls' own minimum touch-target sizes leave room for on one
          line. Wrapping to a second row is the standard, unsurprising
          degradation (confirmed no overflow from 320px up); squeezing
          the icons any smaller would cut into real tap-target size. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">GrindCTRL AI</p>
        <div className="flex items-center justify-end gap-1.5">
          <ModeToggle
            voiceInput={voiceInput}
            voiceOutput={voiceOutput}
            onVoiceInputChange={setVoiceInput}
            onVoiceOutputChange={setVoiceOutput}
            disabled={status === 'sending' || effectiveMicState !== 'idle'}
          />
          {voiceOutput && <VoiceLanguagePicker value={effectiveVoiceLocale} onChange={setVoiceLanguageOverride} />}
          {onClose && (
            <>
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={onClose}
                aria-label={t.launcherClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <MessageList
        messages={messages}
        thinking={status === 'sending' && effectiveMicState === 'idle'}
        onSuggestionClick={handleSuggestionClick}
      />

      {providerError && (
        <div className="border-t bg-destructive/5 px-4 py-3 text-sm" role="alert">
          <p className="font-medium text-destructive">{t.providerErrorTitle}</p>
          <p className="text-xs text-muted-foreground">{t.providerErrorBody}</p>
        </div>
      )}

      {voiceError && (
        <div className="border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground" role="status">
          {voiceError}
        </div>
      )}

      <RateLimitBanner budgets={budgets} rateLimited={rateLimited} redirectPath={redirectPath} />

      <div className="border-t p-3">
        {voiceInput ? (
          <MicControl state={effectiveMicState} levels={recorder.levels} onClick={handleMicClick} errorMessage={effectiveMicError} />
        ) : (
          <div className="flex items-end gap-1 rounded-3xl border bg-background p-1.5 ps-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.composerPlaceholder}
              rows={1}
              disabled={!!rateLimited}
              className="max-h-32 min-h-9 flex-1 resize-none border-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || status === 'sending' || !!rateLimited}
              aria-label={t.send}
              className="size-8 shrink-0 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
