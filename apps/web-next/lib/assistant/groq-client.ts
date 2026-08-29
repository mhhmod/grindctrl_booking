import Groq from 'groq-sdk';
import { ProviderUnavailableError } from './errors';

/* Groq's model lineup changes often — confirmed live against console.groq.com
   as of this build. llama-3.1-8b-instant / llama-3.3-70b-versatile are
   scheduled for shutdown; do not reintroduce them without re-checking
   console.groq.com/docs/deprecations. */
export const CHAT_MODEL = 'openai/gpt-oss-20b';

/* Image understanding (attachment triage). Groq rotates vision models
   faster than anything else in its lineup — llama-3.2-*-vision came and
   went, and llama-4-scout returned model_not_found in production within
   weeks of being current. Pinning one name means the feature breaks
   silently every time that happens, so this is a preference order rather
   than a constant: the first that answers is cached for the process.

   GROQ_VISION_MODEL still wins, so a working model can be pinned without a
   deploy the moment one is known. */
export const VISION_MODEL_CANDIDATES: string[] = [
  process.env.GROQ_VISION_MODEL?.trim(),
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
].filter((model): model is string => Boolean(model));

/** True for the one error worth trying a different model over. Anything
 *  else — auth, rate limit, a malformed image — repeats identically on
 *  every candidate and must not cost four requests to discover. */
export function isModelNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /model_not_found|does not exist or you do not have access/i.test(message);
}

/** Model ids this API key can actually use. Only called to explain a total
 *  failure, so the next fix is a one-line env change rather than a guess. */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const page = await getGroqClient().models.list();
    return (page.data ?? []).map((model) => model.id).filter(Boolean);
  } catch {
    return [];
  }
}
export const STT_MODEL = 'whisper-large-v3-turbo';
export const TTS_MODEL_EN = 'canopylabs/orpheus-v1-english';
export const TTS_MODEL_AR = 'canopylabs/orpheus-arabic-saudi';

let client: Groq | undefined;

export function getGroqClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

/** The SDK already retries transient failures with backoff (see groq-sdk's
 *  default maxRetries) — by the time an error reaches here, retries are
 *  exhausted. Maps it to our taxonomy and logs latency/outcome per call. */
export async function withGroqCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    console.info(`[groq] ${label} ok in ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    console.error(`[groq] ${label} failed after ${Date.now() - start}ms:`, err);
    // Keep the cause. Without it every provider failure — retired model,
    // missing key, rate limit — surfaces as the same opaque sentence.
    throw new ProviderUnavailableError(undefined, { cause: err });
  }
}
