import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkBudget } from '@/lib/assistant/rate-limit-gate';
import { store } from '@/lib/assistant/store-instance';
import { TURN_COST } from '@/lib/assistant/rate-limiter';
import { getGroqClient, withGroqCall, CHAT_MODEL } from '@/lib/assistant/groq-client';
import { SYSTEM_PROMPT } from '@/lib/assistant/system-prompt';

const SESSION_COOKIE = 'gc_assistant_sid';
const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBody {
  message: string;
  history?: ChatMessage[];
}

/**
 * POST /api/assistant/chat
 * SSE. Streams LLM token deltas, then `done`. Emits `rate_limited` (no Groq
 * call made) or `error` (Groq unavailable after the SDK's own retries) as
 * single-frame streams instead. Output length isn't known until the
 * completion finishes, so the pre-check charges a flat per-turn token
 * estimate (TURN_COST) rather than the real usage — a deliberate v1
 * simplification, not a true-up.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const tenant = resolveTenant(userId, existingSessionId);

  const body = (await request.json()) as ChatBody;
  const message = body.message ?? '';
  const history = body.history ?? [];

  const gate = checkBudget(store, tenant.tenantId, tenant.tier, 'chat:tokens', TURN_COST['chat:tokens']);

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

      try {
        const client = getGroqClient();
        const completion = await withGroqCall('chat.completions', () =>
          client.chat.completions.create({
            model: CHAT_MODEL,
            stream: true,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],
          }),
        );

        for await (const chunk of completion as AsyncIterable<{
          choices: { delta: { content?: string } }[];
        }>) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(sseEvent('token', { text: delta }));
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
