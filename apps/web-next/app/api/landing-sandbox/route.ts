import { NextRequest, NextResponse } from 'next/server';
import { runLandingSandbox } from '@/lib/landing-sandbox/service';
import { parseLandingSandboxInput } from '@/lib/landing-sandbox/validator';

function firstIpFromForwarded(value: string | null) {
  if (!value) return 'unknown';
  return value.split(',')[0]?.trim() || 'unknown';
}

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return {
      mode: String(formData.get('mode') ?? ''),
      sessionId: String(formData.get('sessionId') ?? ''),
      locale: String(formData.get('locale') ?? 'en'),
      prompt: String(formData.get('prompt') ?? ''),
      transcript: String(formData.get('transcript') ?? ''),
      fileName: String(formData.get('fileName') ?? ''),
      source: String(formData.get('source') ?? ''),
      file: formData.get('file') as File | null,
    };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    mode: String(body.mode ?? ''),
    sessionId: String(body.sessionId ?? ''),
    locale: String(body.locale ?? 'en'),
    prompt: String(body.prompt ?? ''),
    transcript: String(body.transcript ?? ''),
    fileName: String(body.fileName ?? ''),
    source: String(body.source ?? ''),
    file: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await readPayload(request);
    const parsed = parseLandingSandboxInput(payload);

    if (!parsed.ok || !parsed.input) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error || 'Invalid request payload.',
        },
        { status: 400 },
      );
    }

    const ip = firstIpFromForwarded(request.headers.get('x-forwarded-for')) || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const response = await runLandingSandbox(parsed.input, { ip, userAgent });
    const status = response.meta.limitState === 'rate_limited' ? 429 : 200;
    return NextResponse.json(response, { status });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid JSON payload.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Unable to process landing sandbox request.',
      },
      { status: 500 },
    );
  }
}
