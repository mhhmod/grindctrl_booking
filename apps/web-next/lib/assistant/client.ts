import type { AssistantLocale } from './i18n';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BudgetInfo {
  remaining: number;
  resetSeconds: number;
}

export interface SessionInfo {
  tenantId: string;
  authenticated: boolean;
  budgets: { chat: BudgetInfo; voice: BudgetInfo };
}

export interface RateLimitedInfo {
  resetSeconds: number;
  message: string;
  signInCta: boolean;
}

export type ChatStreamResult =
  | { ok: true }
  | { ok: false; kind: 'rate_limited'; info: RateLimitedInfo }
  | { ok: false; kind: 'provider_unavailable'; message: string };

export type SttResult =
  | { ok: true; transcript: string }
  | { ok: false; kind: 'rate_limited'; info: RateLimitedInfo }
  | { ok: false; kind: 'bad_input'; reason: string }
  | { ok: false; kind: 'provider_unavailable'; message: string };

export type TtsChunkHandler = (audioBase64: string, index: number) => void;

export type TtsStreamResult =
  | { ok: true }
  | { ok: false; kind: 'rate_limited'; info: RateLimitedInfo }
  | { ok: false; kind: 'provider_unavailable'; message: string };

/** The seam between the chat UI and the backend — the UI is built and
 *  verified against a mock implementing this interface first, then wired
 *  to a real fetch-based implementation, per the build's own process. */
export interface AssistantClient {
  fetchSession(): Promise<SessionInfo>;
  streamChat(message: string, history: ChatMessage[], onToken: (text: string) => void): Promise<ChatStreamResult>;
  /** locale improves Whisper's transcription accuracy — it's a hint, not a
   *  hard constraint, since a visitor can still speak the other language. */
  transcribeAudio(blob: Blob, locale?: AssistantLocale): Promise<SttResult>;
  /** locale picks the matching Orpheus voice model (English vs Arabic) —
   *  unlike chat, TTS has no way to detect the reply's language itself. */
  streamTts(text: string, onChunk: TtsChunkHandler, locale?: AssistantLocale): Promise<TtsStreamResult>;
}
