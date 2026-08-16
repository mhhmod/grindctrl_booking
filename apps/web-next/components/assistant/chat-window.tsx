'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
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
}

function playAudioChunksSequentially(base64Chunks: string[]): Promise<void> {
  return base64Chunks.reduce<Promise<void>>(
    (chain, base64) =>
      chain.then(
        () =>
          new Promise<void>((resolve) => {
            if (!base64) {
              resolve();
              return;
            }
            const audio = new Audio(`data:audio/wav;base64,${base64}`);
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          }),
      ),
    Promise.resolve(),
  );
}

/** The unified window: text and voice share the same message history and
 *  the same two toggles (how you send, how you receive) — switching either
 *  mid-conversation never loses context, since both read/write the same
 *  useAssistantChat state. */
export function ChatWindow({ client: clientProp, redirectPath = '/assistant', className }: ChatWindowProps) {
  const { t, dir } = useAssistantLocale();
  const defaultClient = useMemo(() => createRealAssistantClient(), []);
  const client = clientProp ?? defaultClient;
  const [voiceInput, setVoiceInput] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [micError, setMicError] = useState<string | undefined>(undefined);
  const voiceOutputRef = useRef(voiceOutput);
  voiceOutputRef.current = voiceOutput;

  const { messages, status, budgets, rateLimited, providerError, sendText, refreshBudgets, setRateLimited } =
    useAssistantChat(client, (text) => handleAssistantReplyRef.current(text));
  const recorder = useVoiceRecorder();

  const handleAssistantReply = useCallback(
    async (text: string) => {
      if (!voiceOutputRef.current) return;
      setMicState('speaking');
      const chunks: string[] = [];
      const result = await client.streamTts(text, (audioBase64) => {
        chunks.push(audioBase64);
      });
      refreshBudgets();

      if (!result.ok) {
        if (result.kind === 'rate_limited') setRateLimited(result.info);
        setMicState('idle');
        return;
      }

      await playAudioChunksSequentially(chunks);
      setMicState('idle');
    },
    [client, refreshBudgets, setRateLimited],
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
      const result = await client.transcribeAudio(blob);
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
  }, [recorder, client, sendText, t, refreshBudgets, setRateLimited]);

  // Reflect a genuine mic-permission failure as the error state.
  const effectiveMicState: MicState = recorder.state === 'error' && micState !== 'error' ? 'error' : micState;
  const effectiveMicError =
    recorder.state === 'error' ? (recorder.errorReason === 'permission_denied' ? t.micPermissionDenied : t.micError) : micError;

  return (
    <div className={cn('flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm', className)} dir={dir}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold text-foreground">GrindCTRL AI</p>
        <ModeToggle
          voiceInput={voiceInput}
          voiceOutput={voiceOutput}
          onVoiceInputChange={setVoiceInput}
          onVoiceOutputChange={setVoiceOutput}
          disabled={status === 'sending' || effectiveMicState !== 'idle'}
        />
      </div>

      <MessageList messages={messages} thinking={status === 'sending' && effectiveMicState === 'idle'} />

      {providerError && (
        <div className="border-t bg-destructive/5 px-4 py-3 text-sm" role="alert">
          <p className="font-medium text-destructive">{t.providerErrorTitle}</p>
          <p className="text-xs text-muted-foreground">{t.providerErrorBody}</p>
        </div>
      )}

      <RateLimitBanner budgets={budgets} rateLimited={rateLimited} redirectPath={redirectPath} />

      <div className="border-t p-3">
        {voiceInput ? (
          <MicControl state={effectiveMicState} levels={recorder.levels} onClick={handleMicClick} errorMessage={effectiveMicError} />
        ) : (
          <div className="flex items-end gap-2">
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
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || status === 'sending' || !!rateLimited}
              aria-label={t.send}
              className="shrink-0 rounded-xl"
            >
              <Send className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
