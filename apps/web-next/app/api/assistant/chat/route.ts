import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkDistributedBudget, budgetUnavailableStreamResponse } from '@/lib/assistant/distributed-budget';
import { store } from '@/lib/assistant/store-instance';
import { getResourceBudget } from '@/lib/assistant/rate-limiter';
import { chatReservationTokens, CHAT_MAX_COMPLETION_TOKENS } from '@/lib/assistant/chat-budget';
import { getGroqClient, withGroqCall, CHAT_MODEL } from '@/lib/assistant/groq-client';
import { SYSTEM_PROMPT } from '@/lib/assistant/system-prompt';
import { clientIp } from '@/lib/ratelimit';

const SESSION_COOKIE = 'gc_assistant_sid';
const encoder = new TextEncoder();

/* Input bounds apply before the conservative shared token reservation.
   Client-supplied history must never create unbounded provider work. */
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

function sseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/assistant/chat
 * SSE. Streams LLM token deltas, then `done`. Emits `rate_limited` (no Groq
 * call made) or `error` (Groq unavailable; no automatic retries) as
 * single-frame streams instead. Output length isn't known until the
 * completion finishes, so the pre-check reserves an input-byte/framing
 * upper bound plus the explicit completion cap. It never silently refunds
 * an ambiguous or missing provider usage result.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const tenant = resolveTenant(userId, existingSessionId, clientIp(request));

  const body = await request.json().catch(() => null) as { message?: unknown; history?: unknown } | null;
  const message =
    typeof body?.message === 'string' ? body.message.slice(0, MAX_MESSAGE_CHARS).trim() : '';
  const history = sanitizeHistory(body?.history);
  const messages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...history, { role: 'user' as const, content: message }];
  const reservation = chatReservationTokens(messages);
  if (!message || reservation > getResourceBudget(tenant.tier, 'chat:tokens').capacity) {
    return new Response(sseEvent('error', {
      type: 'bad_input',
      message: !message ? 'Please enter a message.' : 'This conversation is too long. Please start a new conversation or send a shorter message.',
    }), { status: 400, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
  }

  const gate = await checkDistributedBudget(store, tenant.tenantId, tenant.tier, 'chat:tokens', reservation)
    .catch(() => 'unavailable' as const);
  if (gate === 'unavailable') return budgetUnavailableStreamResponse();

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
        await withGroqCall('chat.completions', async (signal) => {
          const completion = await client.chat.completions.create({
            model: CHAT_MODEL,
            stream: true,
            max_completion_tokens: CHAT_MAX_COMPLETION_TOKENS,
            messages,
          }, { signal });
          let usage: Record<string, unknown> | null = null;
          for await (const chunk of completion as AsyncIterable<{
            choices: { delta: { content?: string } }[];
            usage?: Record<string, unknown>;
            x_groq?: { usage?: Record<string, unknown> };
          }>) {
            signal.throwIfAborted();
            usage = chunk.x_groq?.usage ?? chunk.usage ?? usage;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(sseEvent('token', { text: delta }));
          }
          // Log completion only after the terminal body has been consumed.
          return { usage };
        }, { signal: request.signal });

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
    status: gate ? 429 : 200,
    headers: {
      ...(gate ? { 'Retry-After': String(gate.resetSeconds) } : {}),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
