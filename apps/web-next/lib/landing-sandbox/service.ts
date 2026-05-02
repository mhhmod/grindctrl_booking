import type {
  LandingSandboxContext,
  LandingSandboxEnvelope,
  LandingSandboxInput,
  LandingSandboxResult,
} from '@/lib/landing-sandbox/types';
import { enforceLandingSandboxRateLimit } from '@/lib/landing-sandbox/limits';
import { buildMockSandboxEnvelope } from '@/lib/landing/mock-sandbox-runner';

type FlatEntity = string | number | boolean | null;

const DEFAULT_TIMEOUT_MS = 12000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timeoutMs() {
  return Math.max(
    MIN_TIMEOUT_MS,
    Math.min(toNumber(process.env.LANDING_TRIAL_INFLOW_TIMEOUT_MS, DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS),
  );
}

function sandboxMode() {
  return process.env.LANDING_SANDBOX_MODE === 'live' ? 'live' : 'mock';
}

function mockEnvelope(input: LandingSandboxInput, fallback: boolean, message?: string): LandingSandboxEnvelope {
  const envelope = buildMockSandboxEnvelope({
    mode: input.mode,
    prompt: input.prompt,
    transcript: input.transcript,
    fileName: input.fileName || input.file?.name,
  });

  return {
    ...envelope,
    fallback,
    message: message || envelope.message,
    meta: {
      ...envelope.meta,
      mode: input.mode,
      locale: input.locale,
      runtime: fallback ? 'fallback' : 'mock',
    },
  };
}

function rateLimitedEnvelope(input: LandingSandboxInput, retryAfterSeconds: number | null): LandingSandboxEnvelope {
  const envelope = mockEnvelope(input, true, "Today's guided previews are complete. Start a 14-day trial to unlock the full workflow.");

  return {
    ...envelope,
    ok: false,
    retryAfterSeconds,
    meta: {
      ...envelope.meta,
      limitState: 'rate_limited',
    },
  };
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function cleanPriority(value: unknown): 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function cleanStatus(value: unknown): 'completed' | 'needs_human' | 'failed' {
  return value === 'completed' || value === 'needs_human' || value === 'failed' ? value : 'completed';
}

function cleanConfidence(value: unknown) {
  const parsed = Math.round(toNumber(value, 80));
  return Math.max(0, Math.min(parsed, 100));
}

function isFlatEntity(value: unknown): value is FlatEntity {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function cleanEntities(value: unknown): Record<string, FlatEntity> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, FlatEntity>>((next, [key, entry]) => {
    if (isFlatEntity(entry)) next[key] = entry;
    return next;
  }, {});
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeResult(value: unknown, input: LandingSandboxInput): LandingSandboxResult | null {
  const raw = objectValue(value);
  if (!raw) return null;

  const decision = objectValue(raw.decision);
  const observability = objectValue(raw.observability);
  const summary = cleanText(raw.summary, '');
  const workflowSlug = cleanText(raw.workflowSlug ?? raw.workflow_slug, '');
  const recommendedAction = cleanText(raw.recommendedAction ?? raw.recommended_action, '');

  if (!summary || !workflowSlug || !recommendedAction || !decision) return null;

  return {
    status: cleanStatus(raw.status),
    workflowSlug,
    summary,
    confidence: cleanConfidence(raw.confidence),
    extractedEntities: cleanEntities(raw.extractedEntities ?? raw.extracted_entities),
    decision: {
      route: cleanText(decision.route, 'manual_review'),
      priority: cleanPriority(decision.priority),
      handoffRequired: typeof decision.handoffRequired === 'boolean'
        ? decision.handoffRequired
        : decision.handoff_required === true,
    },
    recommendedAction,
    executedActions: [],
    externalRefs: [],
    auditTrail: cleanStringArray(raw.auditTrail ?? raw.audit_trail),
    observability: {
      providerRefs: [],
      latencyMs: Math.max(0, toNumber(observability?.latencyMs ?? observability?.latency_ms, 0)),
      costEstimate: Math.max(0, toNumber(observability?.costEstimate ?? observability?.cost_estimate, 0)),
    },
  };
}

function normalizeEnvelope(raw: unknown, input: LandingSandboxInput): LandingSandboxEnvelope | null {
  const body = objectValue(raw);
  if (!body) return null;

  const result = normalizeResult(body.result ?? body, input);
  if (!result) return null;
  const meta = objectValue(body.meta);
  const diagnostics = objectValue(body.diagnostics_safe);
  const requestId = cleanText(meta?.requestId ?? meta?.request_id ?? diagnostics?.requestId ?? diagnostics?.request_id, '');

  return {
    ok: body.ok === false ? false : true,
    fallback: false,
    message: cleanText(body.message, 'Preview generated by workflow.'),
    retryAfterSeconds: typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : null,
    result,
    meta: {
      source: 'landing_sandbox',
      mode: input.mode,
      locale: input.locale,
      timestamp: new Date().toISOString(),
      limitState: 'ok',
      runtime: 'live',
      requestId: requestId || null,
    },
  };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callTrialInflow(input: LandingSandboxInput, context: LandingSandboxContext) {
  const url = process.env.LANDING_TRIAL_INFLOW_URL;
  const token = process.env.LANDING_TRIAL_INFLOW_TOKEN;
  if (!url || !token) return null;

  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-grindctrl-sandbox-token': token,
        },
        body: JSON.stringify({
          source: input.source,
          mode: input.mode,
          locale: input.locale,
          prompt: input.prompt,
          transcript: input.transcript,
          fileName: input.fileName || input.file?.name,
          sessionId: input.sessionId,
          context: {
            ip: context.ip,
            userAgent: context.userAgent,
          },
        }),
        signal,
      }),
    timeoutMs(),
  );

  if (!response.ok) {
    if (process.env.NODE_ENV !== 'production') {
      const authHeader = response.headers.get('www-authenticate');
      const body = await response.text().catch(() => '');
      console.warn('[landing-sandbox] n8n upstream failed', {
        status: response.status,
        statusText: response.statusText,
        wwwAuthenticate: authHeader,
        body: body.slice(0, 180),
      });
    }
    return null;
  }

  try {
    return normalizeEnvelope(await response.json(), input);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[landing-sandbox] n8n returned invalid JSON', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
    return null;
  }
}

export async function runLandingSandbox(input: LandingSandboxInput, context: LandingSandboxContext) {
  const limit = enforceLandingSandboxRateLimit({
    sessionId: input.sessionId,
    ip: context.ip,
  });

  if (!limit.ok) {
    return rateLimitedEnvelope(input, limit.retryAfterSeconds);
  }

  if (sandboxMode() !== 'live') {
    return mockEnvelope(input, false);
  }

  try {
    const liveEnvelope = await callTrialInflow(input, context);
    return liveEnvelope ?? mockEnvelope(input, true, 'Workflow unavailable. Returned mock preview fallback.');
  } catch {
    return mockEnvelope(input, true, 'Workflow unavailable. Returned mock preview fallback.');
  }
}
