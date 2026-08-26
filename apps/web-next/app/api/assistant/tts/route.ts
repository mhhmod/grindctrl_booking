import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkBudget } from '@/lib/assistant/rate-limit-gate';
import { store } from '@/lib/assistant/store-instance';
import { chunkForTts } from '@/lib/assistant/tts-chunker';
import { getGroqClient, withGroqCall, TTS_MODEL_EN, TTS_MODEL_AR } from '@/lib/assistant/groq-client';
import { clientIp } from '@/lib/ratelimit';

const SESSION_COOKIE = 'gc_assistant_sid';
const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/assistant/tts
 * SSE. Sentence-chunks the input (<=200 chars/chunk, Groq's Orpheus limit)
 * and emits one `chunk` event per chunk as it's synthesized, so the client
 * can start playback before the whole reply finishes — the pipelining that
 * hides latency despite Groq's TTS being non-streaming per call. Unlike
 * chat/stt, the real cost (chunk count, character count) is known before
 * calling Groq, so the budget check uses exact numbers, not an estimate.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const tenant = resolveTenant(userId, existingSessionId, clientIp(request));

  const body = (await request.json()) as { text?: string; locale?: string };
  const text = body.text ?? '';
  const chunks = chunkForTts(text);
  // Each Orpheus model has its own, non-overlapping voice roster (confirmed
  // against console.groq.com/docs/text-to-speech/orpheus) — "autumn" is
  // English-only and errors on the Arabic model, so the voice has to switch
  // together with the model, not just the model alone. Voice names must be
  // lowercase — the API rejects the docs page's display-cased "Autumn"/
  // "Noura" with a 400 (confirmed live against the real endpoint).
  const { model, voice } = body.locale === 'ar' ? { model: TTS_MODEL_AR, voice: 'noura' } : { model: TTS_MODEL_EN, voice: 'autumn' };

  const gate =
    chunks.length > 0
      ? (checkBudget(store, tenant.tenantId, tenant.tier, 'tts:requests', chunks.length) ??
        checkBudget(store, tenant.tenantId, tenant.tier, 'tts:characters', text.length))
      : null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (gate) {
        controller.enqueue(
          sseEvent('rate_limited', {
            resetSeconds: gate.resetSeconds,
            message: gate.message,
            signInCta: gate.signInCta,
          }),
        );
        controller.close();
        return;
      }

      if (chunks.length === 0) {
        controller.enqueue(sseEvent('done', {}));
        controller.close();
        return;
      }

      try {
        const client = getGroqClient();
        for (let index = 0; index < chunks.length; index++) {
          // response_format has no working default on Groq's endpoint — it
          // 400s without it (confirmed live) despite the SDK marking it
          // optional. wav is also the only format Orpheus actually supports.
          const audio = await withGroqCall('audio.speech', () =>
            client.audio.speech.create({ model, voice, input: chunks[index], response_format: 'wav' }),
          );
          const arrayBuffer = await audio.arrayBuffer();
          const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
          controller.enqueue(sseEvent('chunk', { index, audioBase64 }));
        }
        controller.enqueue(sseEvent('done', {}));
      } catch {
        controller.enqueue(
          sseEvent('error', {
            type: 'provider_unavailable',
            message: "We're having trouble reaching the AI right now.",
          }),
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
