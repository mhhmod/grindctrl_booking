import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkBudget } from '@/lib/assistant/rate-limit-gate';
import { store } from '@/lib/assistant/store-instance';
import { TURN_COST } from '@/lib/assistant/rate-limiter';
import { getGroqClient, withGroqCall, CHAT_MODEL } from '@/lib/assistant/groq-client';
import { SYSTEM_PROMPT } from '@/lib/assistant/system-prompt';
import { clientIp } from '@/lib/ratelimit';

const SESSION_COOKIE = 'gc_assistant_sid';
const encoder = new TextEncoder();

/* The budget pre-check charges a flat per-turn estimate, so an unbounded
   client-supplied history would let one request carry arbitrarily many
   billed tokens. These caps keep the worst-case amplification per turn
   bounded while leaving plenty of room for a real conversation. */
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_TOTAL_CHARS = 24_000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  const clean: ChatMessage[] = [];
  for (const entry of history) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      ((entry as ChatMessage).role !== 'user' && (entry as ChatMessage).role !== 'assistant') ||
      typeof (entry as ChatMessage).content !== 'string'
    ) {
      continue;
    }
    clean.push({
      role: (entry as ChatMessage).role,
      content: ((entry as ChatMessage).content as string).slice(0, MAX_MESSAGE_CHARS),
    });
  }
  const recent = clean.slice(-MAX_HISTORY_MESSAGES);
  // Keep the most recent messages that fit under the total character budget.
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    total += recent[i].content.length;
    if (total > MAX_HISTORY_TOTAL_CHARS) break;
    kept.unshift(recent[i]);
  }
  return kept;
}

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
  const tenant = resolveTenant(userId, existingSessionId, clientIp(request));

  const body = (await request.json()) as { message?: unknown; history?: unknown };
  const message =
    typeof body.message === 'string' ? body.message.slice(0, MAX_MESSAGE_CHARS) : '';
  const history = sanitizeHistory(body.history);

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
