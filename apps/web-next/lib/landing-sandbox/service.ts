import type { LandingSandboxContext, LandingSandboxEnvelope, LandingSandboxInput, LandingSandboxResult } from '@/lib/landing-sandbox/types';
import { enforceLandingSandboxRateLimit } from '@/lib/landing-sandbox/limits';
import { isTextFile } from '@/lib/landing-sandbox/validator';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const GROQ_SYSTEM_PROMPT = [
  'You design concise AI agent blueprints for business automation MVPs.',
  'Return valid JSON only. No markdown. No prose outside JSON.',
  'Required keys: agent_name, business_goal, workflow, example_output, roi, suggested_stack, next_step.',
  'Workflow must have 4 to 6 steps. suggested_stack must have 3 to 6 items.',
  'Keep output practical and implementation-minded.',
].join('\n');

const BLUEPRINT_TEMPLATES = {
  workflow: {
    agent_name: 'Workflow Planner Blueprint',
    business_goal: 'Turn business workflow requests into deployable AI plans.',
    workflow: [
      'Capture business trigger and desired outcome.',
      'Map required inputs, constraints, and escalation rules.',
      'Define AI and human handoff checkpoints.',
      'Route outputs to CRM or reporting destination.',
      'Track run quality and iterate.',
    ],
    example_output: 'Support-intake workflow drafted with routing, lead capture, and escalation checkpoints.',
    roi: 'Reduces workflow design time and speeds production planning.',
    suggested_stack: ['n8n', 'Groq', 'CRM', 'Google Sheets'],
    next_step: 'Sign in to save and deploy this workflow blueprint.',
  },
  voice: {
    agent_name: 'Voice Lead Capture Blueprint',
    business_goal: 'Extract lead intent and route voice inquiries quickly.',
    workflow: [
      'Transcribe inbound voice note.',
      'Extract lead identity and purchase intent.',
      'Score qualification based on urgency and fit.',
      'Route to sales or support workflow.',
      'Trigger follow-up plan.',
    ],
    example_output: 'Voice lead scored 82/100 and routed to sales follow-up.',
    roi: 'Improves first-response speed for inbound voice leads.',
    suggested_stack: ['n8n', 'Groq Whisper', 'CRM', 'Email'],
    next_step: 'Sign in to sync this lead to CRM or Sheets.',
  },
  file: {
    agent_name: 'File Intake Blueprint',
    business_goal: 'Transform uploaded files into structured operational outputs.',
    workflow: [
      'Capture file metadata and context prompt.',
      'Extract text fields where file is text-like.',
      'Classify route by domain (finance/support/ops).',
      'Prepare structured output card and confidence.',
      'Queue external action only after sign-in.',
    ],
    example_output: 'Invoice fields extracted and routed to finance review.',
    roi: 'Shortens manual triage and extraction effort.',
    suggested_stack: ['n8n', 'Groq', 'Google Sheets', 'Helpdesk'],
    next_step: 'Sign in to export and trigger downstream systems.',
  },
};

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTimeoutMs() {
  return Math.max(3000, Math.min(toNumber(process.env.GROQ_LANDING_SANDBOX_TIMEOUT_MS, 9000), 15000));
}

function getChatModel() {
  return process.env.GROQ_LANDING_SANDBOX_MODEL || '';
}

function getTranscribeModel() {
  return process.env.GROQ_LANDING_SANDBOX_TRANSCRIBE_MODEL || 'whisper-large-v3';
}

function getApiKey() {
  return process.env.GROQ_API_KEY || '';
}

function baseResult(workflowSlug: string): LandingSandboxResult {
  return {
    status: 'completed',
    workflowSlug,
    summary: '',
    confidence: 0,
    extractedEntities: {},
    decision: { route: 'manual_review', priority: 'medium', handoffRequired: false },
    recommendedAction: 'Sign in to continue.',
    executedActions: [],
    externalRefs: [],
    auditTrail: [],
    observability: {
      providerRefs: [],
      latencyMs: 0,
      costEstimate: 0,
    },
  };
}

function buildEnvelope(input: LandingSandboxInput, result: LandingSandboxResult, options: {
  ok: boolean;
  fallback: boolean;
  message: string;
  retryAfterSeconds: number | null;
  limitState: 'ok' | 'rate_limited';
}): LandingSandboxEnvelope {
  return {
    ok: options.ok,
    fallback: options.fallback,
    message: options.message,
    retryAfterSeconds: options.retryAfterSeconds,
    result,
    meta: {
      source: 'landing_sandbox',
      mode: input.mode,
      locale: input.locale,
      timestamp: new Date().toISOString(),
      limitState: options.limitState,
    },
  };
}

function parseBlueprintJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.agent_name || !Array.isArray(parsed.workflow)) {
      return null;
    }
    return parsed as {
      agent_name: string;
      business_goal: string;
      workflow: string[];
      example_output: string;
      roi: string;
      suggested_stack: string[];
      next_step: string;
    };
  } catch {
    return null;
  }
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function requestBlueprint(prompt: string, locale: 'en' | 'ar', mode: 'workflow' | 'voice' | 'file') {
  const apiKey = getApiKey();
  const model = getChatModel();
  if (!apiKey || !model) {
    return { ok: false, code: 'provider_unconfigured' as const, blueprint: null, retryAfterSeconds: null };
  }

  try {
    const response = await withTimeout(
      (signal) =>
        fetch(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: GROQ_SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  `Locale: ${locale}`,
                  `Mode: ${mode}`,
                  `Business task details: ${prompt}`,
                  'Need one production-minded AI agent blueprint for landing page MVP.',
                ].join('\n'),
              },
            ],
          }),
          signal,
        }),
      getTimeoutMs(),
    );

    const retryAfter = response.headers.get('retry-after');
    if (!response.ok) {
      if (response.status === 429) {
        return { ok: false, code: 'rate_limited' as const, blueprint: null, retryAfterSeconds: retryAfter ? Number(retryAfter) : 10 };
      }
      return { ok: false, code: 'provider_error' as const, blueprint: null, retryAfterSeconds: null };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseBlueprintJson(content);
    if (!parsed) {
      return { ok: false, code: 'invalid_json' as const, blueprint: null, retryAfterSeconds: null };
    }
    return { ok: true, code: 'ok' as const, blueprint: parsed, retryAfterSeconds: null };
  } catch {
    return { ok: false, code: 'network_error' as const, blueprint: null, retryAfterSeconds: null };
  }
}

async function transcribeAudio(file: File, locale: 'en' | 'ar') {
  const apiKey = getApiKey();
  const model = getTranscribeModel();
  if (!apiKey || !model) {
    return { ok: false, transcript: '', code: 'provider_unconfigured' as const };
  }

  const formData = new FormData();
  formData.append('file', file, file.name || 'audio.webm');
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  formData.append('language', locale);

  try {
    const response = await withTimeout(
      (signal) =>
        fetch(GROQ_TRANSCRIBE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
          signal,
        }),
      getTimeoutMs(),
    );

    if (!response.ok) {
      return { ok: false, transcript: '', code: 'provider_error' as const };
    }
    const data = (await response.json()) as { text?: string };
    return { ok: true, transcript: String(data.text || '').trim(), code: 'ok' as const };
  } catch {
    return { ok: false, transcript: '', code: 'network_error' as const };
  }
}

function fallbackBlueprintForMode(mode: 'workflow' | 'voice' | 'file') {
  return BLUEPRINT_TEMPLATES[mode];
}

function resultFromBlueprint(mode: 'workflow' | 'voice' | 'file', blueprint: {
  agent_name: string;
  business_goal: string;
  workflow: string[];
  roi: string;
  suggested_stack: string[];
  next_step: string;
}) {
  const result = baseResult(mode === 'workflow' ? 'workflow_planner' : mode === 'voice' ? 'voice_lead_capture' : 'file_image_intake');
  result.summary = `${blueprint.agent_name}: ${blueprint.business_goal}`;
  result.confidence = 78;
  result.extractedEntities = {
    agent_name: blueprint.agent_name,
    workflow_steps: blueprint.workflow.slice(0, 6).join(' | '),
    roi: blueprint.roi,
    suggested_stack: blueprint.suggested_stack.slice(0, 4).join(', '),
  };
  result.recommendedAction = blueprint.next_step;
  result.decision = {
    route: mode === 'voice' ? 'sales_or_support_triage' : mode === 'file' ? 'ops_intake' : 'workflow_design',
    priority: 'medium',
    handoffRequired: false,
  };
  result.auditTrail = ['anonymous_request_received', 'normalized_output_returned'];
  return result;
}

function extractLeadSignals(transcript: string) {
  const companyMatch = transcript.match(/from\s+([A-Za-z0-9&.\-\s]{2,40})/i);
  const needMatch = transcript.match(/need\s+([^.,;]{4,70})/i);
  const priority = /urgent|asap|today|high/i.test(transcript) ? 'high' : 'medium';
  const score = /pricing|budget|buy|demo/i.test(transcript) ? 84 : 72;
  return {
    company: companyMatch ? companyMatch[1].trim() : 'Unknown',
    need: needMatch ? needMatch[1].trim() : 'General workflow support',
    priority,
    score,
  };
}

async function fileEntities(file: File | null | undefined, prompt: string) {
  if (!file) {
    return {
      asset_name: 'none',
      mime_type: 'none',
      extracted_fields: 0,
      text_preview: '',
      route_hint: prompt.toLowerCase().includes('invoice') ? 'finance_ops' : 'support_ops',
    };
  }

  const mime = (file.type || '').toLowerCase();
  if (isTextFile(file)) {
    const raw =
      typeof file.text === 'function'
        ? await file.text()
        : new TextDecoder().decode(await file.arrayBuffer());
    const clipped = raw.slice(0, 1200).replace(/\s+/g, ' ').trim();
    return {
      asset_name: file.name || 'uploaded',
      mime_type: mime,
      extracted_fields: /invoice|total|amount|due/i.test(clipped) ? 6 : 3,
      text_preview: clipped.slice(0, 180),
      route_hint: /invoice|bill|receipt/i.test(`${file.name} ${clipped} ${prompt}`) ? 'finance_ops' : 'support_ops',
    };
  }

  return {
    asset_name: file.name || 'uploaded',
    mime_type: mime,
    extracted_fields: /invoice|bill|receipt/i.test(`${file.name} ${prompt}`) ? 4 : 2,
    text_preview: '',
    route_hint: /invoice|bill|receipt/i.test(`${file.name} ${prompt}`) ? 'finance_ops' : 'support_ops',
  };
}

export async function runLandingSandbox(input: LandingSandboxInput, context: LandingSandboxContext) {
  const rateLimit = enforceLandingSandboxRateLimit({ sessionId: input.sessionId, ip: context.ip });
  if (!rateLimit.ok) {
    const rateLimited = baseResult('rate_limited');
    rateLimited.status = 'failed';
    rateLimited.summary = 'Daily anonymous sandbox cap reached.';
    rateLimited.confidence = 0;
    rateLimited.decision = { route: 'blocked', priority: 'low', handoffRequired: false };
    rateLimited.recommendedAction = 'Sign in to continue.';
    rateLimited.auditTrail = ['anonymous_rate_limit_hit'];

    return buildEnvelope(input, rateLimited, {
      ok: false,
      fallback: true,
      message: 'Rate limit exceeded for anonymous sandbox.',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limitState: 'rate_limited',
    });
  }

  const start = Date.now();

  if (input.mode === 'workflow') {
    const provider = await requestBlueprint(input.prompt, input.locale, 'workflow');
    const fallback = !provider.ok || !provider.blueprint;
    const blueprint = fallback ? fallbackBlueprintForMode('workflow') : provider.blueprint;
    const result = resultFromBlueprint('workflow', blueprint);
    result.observability.latencyMs = Date.now() - start;
    result.observability.providerRefs = fallback ? [] : ['groq.chat'];
    return buildEnvelope(input, result, {
      ok: true,
      fallback,
      message: fallback ? 'Provider unavailable. Returned deterministic fallback blueprint.' : 'Workflow blueprint generated.',
      retryAfterSeconds: provider.retryAfterSeconds,
      limitState: 'ok',
    });
  }

  if (input.mode === 'voice') {
    let transcript = input.transcript || '';
    let fallback = false;
    if (!transcript && input.file) {
      const transcribed = await transcribeAudio(input.file, input.locale);
      if (transcribed.ok) {
        transcript = transcribed.transcript;
      } else {
        fallback = true;
      }
    }

    const lead = extractLeadSignals(transcript || input.prompt);
    const result = baseResult('voice_lead_capture');
    result.summary = 'Voice lead capture completed with structured extraction.';
    result.confidence = lead.score;
    result.extractedEntities = {
      transcript_preview: (transcript || input.prompt).slice(0, 160),
      company: lead.company,
      need: lead.need,
      lead_priority: lead.priority,
      lead_score: lead.score,
    };
    result.decision = {
      route: lead.score >= 80 ? 'sales_follow_up' : 'support_triage',
      priority: lead.priority === 'high' ? 'high' : 'medium',
      handoffRequired: lead.score < 70,
    };
    result.recommendedAction = 'Sign in to save and sync this lead.';
    result.auditTrail = ['anonymous_request_received', 'voice_signal_extracted'];
    result.observability.latencyMs = Date.now() - start;
    return buildEnvelope(input, result, {
      ok: true,
      fallback,
      message: fallback ? 'Transcription provider unavailable. Used deterministic transcript fallback.' : 'Voice lead extraction completed.',
      retryAfterSeconds: null,
      limitState: 'ok',
    });
  }

  const entities = await fileEntities(input.file, input.prompt);
  const fileResult = baseResult('file_image_intake');
  fileResult.summary = 'File/image intake completed with structured extraction.';
  fileResult.confidence = 76;
  fileResult.extractedEntities = {
    ...entities,
    context: input.prompt || 'No additional context provided.',
  };
  fileResult.decision = {
    route: String(entities.route_hint),
    priority: 'medium',
    handoffRequired: false,
  };
  fileResult.recommendedAction = 'Sign in to export and route this intake result.';
  fileResult.auditTrail = ['anonymous_request_received', 'file_intake_normalized'];
  fileResult.observability.latencyMs = Date.now() - start;
  return buildEnvelope(input, fileResult, {
    ok: true,
    fallback: true,
    message: 'File/image intake returned metadata-first structured output.',
    retryAfterSeconds: null,
    limitState: 'ok',
  });
}
