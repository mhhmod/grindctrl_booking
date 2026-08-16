import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkBudget } from '@/lib/assistant/rate-limit-gate';
import { store } from '@/lib/assistant/store-instance';
import { TURN_COST } from '@/lib/assistant/rate-limiter';
import { getGroqClient, withGroqCall, STT_MODEL } from '@/lib/assistant/groq-client';
import { RateLimitedError } from '@/lib/assistant/errors';

const SESSION_COOKIE = 'gc_assistant_sid';

function rateLimitedResponse(gate: RateLimitedError) {
  return NextResponse.json(
    { error: 'rate_limited', resetSeconds: gate.resetSeconds, message: gate.message, signInCta: gate.signInCta },
    { status: 429 },
  );
}

/**
 * POST /api/assistant/stt
 * multipart/form-data with an `audio` field. Real audio duration isn't
 * cheap to parse from an arbitrary container, so both stt buckets are
 * pre-checked with a flat per-call estimate (TURN_COST) — same deliberate
 * simplification as the chat route's token estimate.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const tenant = resolveTenant(userId, existingSessionId);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'bad_input', reason: 'Invalid upload.' }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'bad_input', reason: 'No audio was received.' }, { status: 400 });
  }

  const requestsGate = checkBudget(store, tenant.tenantId, tenant.tier, 'stt:requests', TURN_COST['stt:requests']);
  if (requestsGate) return rateLimitedResponse(requestsGate);

  const secondsGate = checkBudget(
    store,
    tenant.tenantId,
    tenant.tier,
    'stt:audio_seconds',
    TURN_COST['stt:audio_seconds'],
  );
  if (secondsGate) return rateLimitedResponse(secondsGate);

  try {
    const client = getGroqClient();
    const transcription = await withGroqCall('audio.transcriptions', () =>
      client.audio.transcriptions.create({ file: audio, model: STT_MODEL }),
    );
    return NextResponse.json({ transcript: transcription.text });
  } catch {
    return NextResponse.json(
      { error: 'provider_unavailable', message: "We're having trouble reaching the AI right now." },
      { status: 502 },
    );
  }
}
