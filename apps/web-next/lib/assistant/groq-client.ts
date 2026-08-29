import Groq from 'groq-sdk';
import { ProviderUnavailableError } from './errors';

/* Groq's model lineup changes often — confirmed live against console.groq.com
   as of this build. llama-3.1-8b-instant / llama-3.3-70b-versatile are
   scheduled for shutdown; do not reintroduce them without re-checking
   console.groq.com/docs/deprecations. */
export const CHAT_MODEL = 'openai/gpt-oss-20b';
export const STT_MODEL = 'whisper-large-v3-turbo';
export const TTS_MODEL_EN = 'canopylabs/orpheus-v1-english';
export const TTS_MODEL_AR = 'canopylabs/orpheus-arabic-saudi';

/* No vision model lives here: this account's Groq key serves chat, speech
   and safety classifiers only — checked against the live model list, not
   assumed. Attachment triage goes through lib/messenger/vision-client.ts
   (OpenRouter), which is already a configured dependency for Try-On. */

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
