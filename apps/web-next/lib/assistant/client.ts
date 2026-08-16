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
  transcribeAudio(blob: Blob): Promise<SttResult>;
  streamTts(text: string, onChunk: TtsChunkHandler): Promise<TtsStreamResult>;
}
