import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { checkDistributedBudget } from '@/lib/assistant/distributed-budget';
import { rateLimitErrorResponse, RequestRateLimitError } from '@/lib/request-rate-limit';
import { store } from '@/lib/assistant/store-instance';
import { TURN_COST } from '@/lib/assistant/rate-limiter';
import { getGroqClient, withGroqCall, STT_MODEL } from '@/lib/assistant/groq-client';
import { RateLimitedError } from '@/lib/assistant/errors';
import { clientIp } from '@/lib/ratelimit';

const SESSION_COOKIE = 'gc_assistant_sid';
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/x-m4a']);

function rateLimitedResponse(gate: RateLimitedError) {
  return NextResponse.json(
    { error: 'rate_limited', resetSeconds: gate.resetSeconds, message: gate.message, signInCta: gate.signInCta },
    { status: 429, headers: { 'Retry-After': String(gate.resetSeconds) } },
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
  const tenant = resolveTenant(userId, existingSessionId, clientIp(request));

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
  if (audio.size > MAX_AUDIO_BYTES || !AUDIO_TYPES.has(audio.type.split(';')[0].trim().toLowerCase())) {
    return NextResponse.json(
      { error: 'bad_input', reason: 'Upload a supported audio recording up to 2 MB.' },
      { status: audio.size > MAX_AUDIO_BYTES ? 413 : 415 },
    );
  }
  const locale = formData.get('locale');
  // A hint, not a hard constraint — Whisper still auto-detects if the
  // visitor speaks the other language, this just improves accuracy for the
  // common case of them speaking whichever language the UI is already in.
  const language = locale === 'ar' ? 'ar' : 'en';

  const requestsGate = await checkDistributedBudget(store, tenant.tenantId, tenant.tier, 'stt:requests', TURN_COST['stt:requests'])
    .catch(() => 'unavailable' as const);
  if (requestsGate === 'unavailable') return rateLimitErrorResponse(new RequestRateLimitError(503, 30));
  if (requestsGate) return rateLimitedResponse(requestsGate);

  const secondsGate = await checkDistributedBudget(
    store,
    tenant.tenantId,
    tenant.tier,
    'stt:audio_seconds',
    TURN_COST['stt:audio_seconds'],
  ).catch(() => 'unavailable' as const);
  if (secondsGate === 'unavailable') return rateLimitErrorResponse(new RequestRateLimitError(503, 30));
  if (secondsGate) return rateLimitedResponse(secondsGate);

  try {
    const client = getGroqClient();
    const transcription = await withGroqCall('audio.transcriptions', (signal) =>
      client.audio.transcriptions.create({ file: audio, model: STT_MODEL, language }, { signal }),
      { signal: request.signal },
    );
    return NextResponse.json({ transcript: transcription.text });
  } catch {
    return NextResponse.json(
      { error: 'provider_unavailable', message: "We're having trouble reaching the AI right now." },
      { status: 502 },
    );
  }
}
