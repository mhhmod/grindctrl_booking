import type {
  AssistantClient,
  ChatMessage,
  ChatStreamResult,
  RateLimitedInfo,
  SessionInfo,
  SttResult,
  TtsChunkHandler,
  TtsStreamResult,
} from './client';
import { SseFrameParser, type SseFrame } from './sse-parser';

async function consumeSseStream<T>(response: Response, handleFrame: (frame: SseFrame) => T | undefined): Promise<T> {
  const body = response.body;
  if (!body) throw new Error('Response has no body to stream.');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseFrameParser();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
      const result = handleFrame(frame);
      if (result !== undefined) return result;
    }
  }

  throw new Error('Stream ended without a terminal event.');
}

function handleChatOrTtsFrame(
  frame: SseFrame,
  onNonTerminal: (frame: SseFrame) => void,
): ChatStreamResult | TtsStreamResult | undefined {
  switch (frame.event) {
    case 'done':
      return { ok: true };
    case 'rate_limited':
      return { ok: false, kind: 'rate_limited', info: frame.data as RateLimitedInfo };
    case 'error':
      return { ok: false, kind: 'provider_unavailable', message: (frame.data as { message: string }).message };
    default:
      onNonTerminal(frame);
      return undefined;
  }
}

/** Real, fetch-backed implementation of AssistantClient against this app's
 *  own /api/assistant/* routes — the UI was built and verified against the
 *  mock first, per the brief's own process; this is the swap-in. */
export function createRealAssistantClient(): AssistantClient {
  return {
    async fetchSession(): Promise<SessionInfo> {
      const res = await fetch('/api/assistant/session');
      return res.json();
    },

    async streamChat(message: string, history: ChatMessage[], onToken: (text: string) => void): Promise<ChatStreamResult> {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      return consumeSseStream(res, (frame) =>
        handleChatOrTtsFrame(frame, (f) => {
          if (f.event === 'token') onToken((f.data as { text: string }).text);
        }),
      ) as Promise<ChatStreamResult>;
    },

    async transcribeAudio(blob: Blob): Promise<SttResult> {
      const form = new FormData();
      form.set('audio', blob, 'clip.webm');
      const res = await fetch('/api/assistant/stt', { method: 'POST', body: form });
      const body = await res.json();

      if (body.transcript) return { ok: true, transcript: body.transcript };
      if (body.error === 'rate_limited') {
        return {
          ok: false,
          kind: 'rate_limited',
          info: { resetSeconds: body.resetSeconds, message: body.message, signInCta: body.signInCta },
        };
      }
      if (body.error === 'bad_input') return { ok: false, kind: 'bad_input', reason: body.reason };
      return { ok: false, kind: 'provider_unavailable', message: body.message ?? 'Unavailable' };
    },

    async streamTts(text: string, onChunk: TtsChunkHandler): Promise<TtsStreamResult> {
      const res = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return consumeSseStream(res, (frame) =>
        handleChatOrTtsFrame(frame, (f) => {
          if (f.event === 'chunk') {
            const data = f.data as { index: number; audioBase64: string };
            onChunk(data.audioBase64, data.index);
          }
        }),
      ) as Promise<TtsStreamResult>;
    },
  };
}
