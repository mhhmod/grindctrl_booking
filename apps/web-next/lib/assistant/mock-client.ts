import type {
  AssistantClient,
  ChatMessage,
  ChatStreamResult,
  SessionInfo,
  SttResult,
  TtsChunkHandler,
  TtsStreamResult,
} from './client';

const CANNED_REPLY =
  "Sure, I can help with that. This is a mocked reply so the interface can be built and checked before it's wired to the real Groq-backed API.";

/** A deterministic in-memory stand-in for the real API, so the chat UI can
 *  be built and manually exercised (all four modes, including hitting the
 *  limit) before the backend is wired in. */
export function createMockAssistantClient(
  options: { chatCapacity?: number; voiceCapacity?: number; failProvider?: boolean } = {},
): AssistantClient {
  const chatCapacity = options.chatCapacity ?? 8;
  const voiceCapacity = options.voiceCapacity ?? 3;
  let chatRemaining = chatCapacity;
  let voiceRemaining = voiceCapacity;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    async fetchSession(): Promise<SessionInfo> {
      return {
        tenantId: 'mock-tenant',
        authenticated: false,
        budgets: {
          chat: { remaining: chatRemaining, resetSeconds: chatRemaining > 0 ? 0 : 3_600 },
          voice: { remaining: voiceRemaining, resetSeconds: voiceRemaining > 0 ? 0 : 3_600 },
        },
      };
    },

    async streamChat(
      _message: string,
      _history: ChatMessage[],
      onToken: (text: string) => void,
    ): Promise<ChatStreamResult> {
      if (chatRemaining <= 0) {
        return { ok: false, kind: 'rate_limited', info: { resetSeconds: 3_600, message: '', signInCta: true } };
      }
      if (options.failProvider) {
        return { ok: false, kind: 'provider_unavailable', message: '' };
      }

      chatRemaining -= 1;
      for (const word of CANNED_REPLY.split(' ')) {
        await delay(35);
        onToken(`${word} `);
      }
      return { ok: true };
    },

    async transcribeAudio(_blob: Blob): Promise<SttResult> {
      await delay(400);
      if (voiceRemaining <= 0) {
        return { ok: false, kind: 'rate_limited', info: { resetSeconds: 3_600, message: '', signInCta: true } };
      }
      return { ok: true, transcript: 'Show me the blue jacket in a medium.' };
    },

    async streamTts(_text: string, onChunk: TtsChunkHandler): Promise<TtsStreamResult> {
      if (voiceRemaining <= 0) {
        return { ok: false, kind: 'rate_limited', info: { resetSeconds: 3_600, message: '', signInCta: true } };
      }
      voiceRemaining -= 1;
      await delay(300);
      onChunk('', 0);
      return { ok: true };
    },
  };
}
