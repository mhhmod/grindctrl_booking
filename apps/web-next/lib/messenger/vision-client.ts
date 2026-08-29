import 'server-only';

import { describeProviderError, ProviderUnavailableError } from '@/lib/assistant/errors';

/* Image understanding for attachment triage.

   NOT Groq: this account's Groq key has no multimodal model on it at all —
   confirmed against the live model list, which is chat, speech and safety
   classifiers only. OpenRouter is already a configured, paid dependency
   here (the Try-On image runner uses the same key), and it carries a couple
   of hundred vision-capable models, so triage goes through it.

   Provider-agnostic by the same principle as the Try-On runner: the model
   is a slug, swappable by env without a code change. */

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REQUEST_TIMEOUT_MS = 30_000;

/* Preference order, every slug confirmed against OpenRouter's live model
   list as accepting image input and returning text. Cheap-and-fast first:
   this is a short classification of one photo, not a reasoning task.
   STORE_CHAT_VISION_MODEL overrides the lot without a deploy. */
export const VISION_MODEL_CANDIDATES: string[] = [
  process.env.STORE_CHAT_VISION_MODEL?.trim(),
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5-nano',
  'mistralai/mistral-small-3.2-24b-instruct',
].filter((model): model is string => Boolean(model));

export class VisionNotConfiguredError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY is not set; attachment triage is disabled.');
    this.name = 'VisionNotConfiguredError';
  }
}

/** One vision completion. Returns the raw assistant text; parsing is the
 *  caller's business. Throws ProviderUnavailableError with the provider's
 *  own message as the cause, so the model-retirement check can see it. */
export async function visionComplete(input: {
  model: string;
  systemPrompt: string;
  userText: string;
  dataUrl: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new VisionNotConfiguredError();

  const started = Date.now();
  let response: Response;
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
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        max_tokens: input.maxTokens ?? 300,
        messages: [
          { role: 'system', content: input.systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: input.userText },
              { type: 'image_url', image_url: { url: input.dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    throw new ProviderUnavailableError(undefined, { cause: error });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[vision] ${input.model} failed after ${Date.now() - started}ms: ${response.status}`);
    throw new ProviderUnavailableError(undefined, {
      cause: new Error(`${response.status} ${body.slice(0, 600)}`),
    });
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    error?: { message?: string };
  } | null;

  /* OpenRouter can return 200 with an error body when a downstream provider
     rejects the request — treat it exactly like a transport failure rather
     than parsing an empty choice list into "no triage". */
  if (payload?.error?.message) {
    throw new ProviderUnavailableError(undefined, { cause: new Error(payload.error.message) });
  }
  console.info(`[vision] ${input.model} ok in ${Date.now() - started}ms`);
  return (payload?.choices?.[0]?.message?.content ?? '').toString();
}

/** Vision-capable slugs OpenRouter currently serves. Public endpoint — no
 *  key needed — and only called to explain a total failure, so fixing it is
 *  an env change rather than a guess. */
export async function listAvailableVisionModels(): Promise<string[]> {
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: Array<{ id?: string; architecture?: { input_modalities?: string[] } }>;
    };
    return (payload.data ?? [])
      .filter((model) => model.architecture?.input_modalities?.includes('image'))
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

export { describeProviderError };
