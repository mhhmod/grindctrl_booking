import Groq from 'groq-sdk';
import { ProviderUnavailableError } from './errors';

// Deployment preflight verifies catalogue presence. That is not evidence of
// output quality, account capacity or a profitable price; those are separate gates.
export const CHAT_MODEL = 'openai/gpt-oss-120b';
export const STT_MODEL = 'whisper-large-v3-turbo';
export const TTS_MODEL_EN = 'canopylabs/orpheus-v1-english';
export const TTS_MODEL_AR = 'canopylabs/orpheus-arabic-saudi';

/* No vision model lives here: this account's Groq key serves chat, speech
   and safety classifiers only — checked against the live model list, not
   assumed. Attachment triage goes through lib/messenger/vision-client.ts
   (OpenRouter), which is already a configured dependency for Try-On. */

let client: Groq | undefined;
export const GROQ_REQUEST_TIMEOUT_MS = 30_000;

export function getGroqClient(): Groq {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: GROQ_REQUEST_TIMEOUT_MS,
      // An ambiguous timed-out generation must not multiply provider work.
      maxRetries: 0,
    });
  }
  return client;
}

/** The callback must consume the entire response, including streaming/binary
 * bodies, and pass signal to the SDK. Its header-only timeout is insufficient.
 * Log only aggregate usage and safe status, never prompt/result/error bodies. */
export async function withGroqCall<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const start = Date.now();
  const deadline = new AbortController();
  const signal = options.signal ? AbortSignal.any([deadline.signal, options.signal]) : deadline.signal;
  const timer = setTimeout(
    () => deadline.abort(new DOMException('Provider deadline exceeded', 'TimeoutError')),
    options.timeoutMs ?? GROQ_REQUEST_TIMEOUT_MS,
  );
  let onAbort: () => void = () => {};
  try {
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
    const result = await Promise.race([
      interrupted,
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return fn(signal);
      }),
    ]);
    const usage =
      result && typeof result === 'object' && 'usage' in result
        ? (result.usage as Record<string, unknown> | null)
        : null;
    const tokenCount = (field: string) => {
      const value = usage?.[field];
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    };
    console.info('[groq] completion', {
      operation: label,
      durationMs: Date.now() - start,
      promptTokens: tokenCount('prompt_tokens'),
      completionTokens: tokenCount('completion_tokens'),
      totalTokens: tokenCount('total_tokens'),
    });
    return result;
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err ? err.status : null;
    console.error('[groq] failure', {
      operation: label,
      durationMs: Date.now() - start,
      status: typeof status === 'number' && Number.isInteger(status) ? status : null,
    });
    // Keep the cause. Without it every provider failure — retired model,
    // missing key, rate limit — surfaces as the same opaque sentence.
    throw new ProviderUnavailableError(undefined, { cause: err });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
