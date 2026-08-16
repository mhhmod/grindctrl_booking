'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantClient, BudgetInfo, RateLimitedInfo } from '@/lib/assistant/client';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audio?: { chunks: string[] };
}

type Status = 'idle' | 'sending';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function useAssistantChat(client: AssistantClient, onAssistantReply?: (text: string, messageId: string) => void) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [budgets, setBudgets] = useState<{ chat: BudgetInfo; voice: BudgetInfo } | null>(null);
  const [rateLimited, setRateLimited] = useState<RateLimitedInfo | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const setMessageAudio = useCallback((messageId: string, chunks: string[]) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, audio: { chunks } } : m)));
  }, []);
  const messagesRef = useRef<DisplayMessage[]>([]);
  messagesRef.current = messages;

  const refreshBudgets = useCallback(() => {
    client.fetchSession().then((session) => setBudgets(session.budgets));
  }, [client]);

  useEffect(() => {
    refreshBudgets();
  }, [refreshBudgets]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'sending') return;

      setProviderError(null);
      setRateLimited(null);
      setStatus('sending');

      const userMessage: DisplayMessage = { id: newId(), role: 'user', content: trimmed };
      const history = messagesRef.current.map(({ role, content }) => ({ role, content }));
      setMessages((prev) => [...prev, userMessage]);

      const assistantId = newId();
      let assistantStarted = false;
      let fullReply = '';

      const result = await client.streamChat(trimmed, history, (token) => {
        fullReply += token;
        if (!assistantStarted) {
          assistantStarted = true;
          setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: token }]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
          );
        }
      });

      if (!result.ok) {
        if (result.kind === 'rate_limited') setRateLimited(result.info);
        else setProviderError(result.message);
      } else if (fullReply.trim()) {
        onAssistantReply?.(fullReply.trim(), assistantId);
      }

      setStatus('idle');
      refreshBudgets();
    },
    [client, status, onAssistantReply, refreshBudgets],
  );

  return {
    messages,
    status,
    budgets,
    rateLimited,
    providerError,
    sendText,
    refreshBudgets,
    /** For the voice paths (STT/TTS), which hit their own rate limit
     *  independently of chat — routed into the same banner state so every
     *  mode shows the identical fallback, not a mode-specific one. */
    setRateLimited,
    /** Separate from providerError: a TTS failure means the chat reply
     *  already succeeded and is on screen as text — reusing providerError's
     *  "trouble reaching the AI" wording would misreport a fully-working
     *  reply as broken. This is deliberately a quieter, distinct message. */
    voiceError,
    setVoiceError,
    /** Attaches TTS audio to the specific message it was synthesized for —
     *  playback now lives inside VoiceMessagePlayer, keyed off this, rather
     *  than being played fire-and-forget from chat-window.tsx. */
    setMessageAudio,
  };
}
