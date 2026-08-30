import Groq from 'groq-sdk';
import { ProviderUnavailableError } from './errors';

/* Groq's model lineup changes often — confirmed live against console.groq.com
   as of this build. llama-3.1-8b-instant / llama-3.3-70b-versatile are
   scheduled for shutdown; do not reintroduce them without re-checking
   console.groq.com/docs/deprecations.

   gpt-oss-120b over gpt-oss-20b: same family and 131k context, so this is a
   same-prompt-format swap, not a migration. 120b lists explicit tool-calling
   support where 20b's is unlisted, and at $0.15/$0.60 per M tokens (2x 20b's
   $0.075/$0.30 — confirmed live, not estimated) the absolute cost per reply
   is still a fraction of a cent at this app's message volumes, so the
   quality gain costs nothing that matters against subscription revenue. */
export const CHAT_MODEL = 'openai/gpt-oss-120b';
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
