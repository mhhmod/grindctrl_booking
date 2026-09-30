import 'server-only';

import { ProviderUnavailableError } from '@/lib/assistant/errors';
import { CHAT_MODEL, getGroqClient, withGroqCall } from '@/lib/assistant/groq-client';

/* Store Chat's text model, through OpenRouter.

   NOT Groq: the Groq account is on the free tier, which caps this model at
   1,000 requests and 200,000 tokens a day for every store together, and its
   paid tier is not available to this account. OpenRouter is already a
   configured, paid dependency here (the Try-On image runner and attachment
   triage use the same key).

   The same open model the chat ran on before, served by whichever of its
   providers is up. The backup model answers only when none of them can.
   Providers that store or train on prompts are excluded: these are
   shoppers' messages. */

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const STORE_CHAT_MODEL = 'openai/gpt-oss-120b';
export const STORE_CHAT_BACKUP_MODEL = 'google/gemini-2.5-flash-lite';
export const STORE_CHAT_TIMEOUT_MS = 30_000;

export interface StoreChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StoreChatRequest {
  messages: StoreChatMessage[];
  temperature: number;
  maxTokens: number;
}

export class StoreChatNotConfiguredError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY is not set; Store Chat replies are disabled.');
    this.name = 'StoreChatNotConfiguredError';
  }
}

export function storeChatRequestBody(input: StoreChatRequest) {
  return {
    models: [STORE_CHAT_MODEL, STORE_CHAT_BACKUP_MODEL],
    provider: { data_collection: 'deny' },
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    messages: input.messages,
  };
}

/** One Store Chat completion. OpenRouter first; if it cannot answer at all
 *  (no credit, key limit, outage), the same open model on Groq answers
 *  instead, so shoppers are not left without a reply. Logs only which
 *  provider answered, timing and aggregate usage, never the prompt or the
 *  reply. */
export async function storeChatComplete(operation: string, input: StoreChatRequest): Promise<string> {
  try {
    return await openRouterComplete(operation, input);
  } catch (primaryError) {
    if (!process.env.GROQ_API_KEY?.trim()) throw primaryError;
    console.warn('[store-chat] fallback', { operation, to: 'groq' });
    const completion = await withGroqCall(`${operation}.fallback`, (signal) =>
      getGroqClient().chat.completions.create(
        {
          model: CHAT_MODEL,
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          messages: input.messages,
        },
        { signal },
      ),
    );
    return (completion.choices?.[0]?.message?.content ?? '').toString();
  }
}

async function openRouterComplete(operation: string, input: StoreChatRequest): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new ProviderUnavailableError(undefined, { cause: new StoreChatNotConfiguredError() });

  const started = Date.now();
  const fail = (status: number | null, cause: unknown): never => {
    console.error('[store-chat] failure', { operation, durationMs: Date.now() - started, status });
    throw new ProviderUnavailableError(undefined, { cause });
  };

  let response: Response;
  let payload: {
    model?: unknown;
    provider?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: Record<string, unknown> | null;
    error?: { message?: string };
  } | null;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // OpenRouter attributes usage by these; harmless if absent.
        'HTTP-Referer': 'https://grindctrl.cloud',
        'X-Title': 'GRINDCTRL Store Chat',
      },
      body: JSON.stringify(storeChatRequestBody(input)),
      signal: AbortSignal.timeout(STORE_CHAT_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return fail(response.status, new Error(`${response.status} ${body.slice(0, 600)}`));
    }
    payload = await response.json().catch(() => null);
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    return fail(null, error);
  }

  /* OpenRouter can return 200 with an error body when a downstream provider
     rejects the request: treat it as a failure, not as an empty reply. */
  if (payload?.error?.message) return fail(response.status, new Error(payload.error.message));

  const usage = payload?.usage ?? null;
  const count = (field: string) => {
    const value = usage?.[field];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  };
  console.info('[store-chat] completion', {
    operation,
    durationMs: Date.now() - started,
    model: typeof payload?.model === 'string' ? payload.model : null,
    provider: typeof payload?.provider === 'string' ? payload.provider : null,
    promptTokens: count('prompt_tokens'),
    completionTokens: count('completion_tokens'),
    costUsd: count('cost'),
  });
  return (payload?.choices?.[0]?.message?.content ?? '').toString();
}
