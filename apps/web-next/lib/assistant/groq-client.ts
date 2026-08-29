import Groq from 'groq-sdk';
import { ProviderUnavailableError } from './errors';

/* Groq's model lineup changes often — confirmed live against console.groq.com
   as of this build. llama-3.1-8b-instant / llama-3.3-70b-versatile are
   scheduled for shutdown; do not reintroduce them without re-checking
   console.groq.com/docs/deprecations. */
export const CHAT_MODEL = 'openai/gpt-oss-20b';
/** Image understanding (attachment triage). Overridable without a deploy
 *  because Groq rotates vision models faster than the chat lineup. */
export const VISION_MODEL =
  process.env.GROQ_VISION_MODEL?.trim() || 'meta-llama/llama-4-scout-17b-16e-instruct';
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
    throw new ProviderUnavailableError();
  }
}
