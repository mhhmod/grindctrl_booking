import type { LandingSandboxEnvelope, SandboxMode } from '@/lib/landing-sandbox/types';

interface MockSandboxInput {
  mode: SandboxMode;
  prompt: string;
  transcript?: string;
  fileName?: string;
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function modeLabel(mode: SandboxMode) {
  if (mode === 'voice') return 'Voice lead capture';
  if (mode === 'file') return 'File and image intake';
  return 'Workflow planner';
}

function workflowSlug(mode: SandboxMode) {
  if (mode === 'voice') return 'voice_lead_capture';
  if (mode === 'file') return 'file_image_intake';
  return 'workflow_planner';
}

export function buildMockSandboxEnvelope(input: MockSandboxInput): LandingSandboxEnvelope {
  const signal = clean(input.transcript || input.prompt || input.fileName || 'guided workflow preview');
  const isVoice = input.mode === 'voice';
  const isFile = input.mode === 'file';

  return {
    ok: true,
    fallback: false,
    message: 'Preview generated locally.',
    retryAfterSeconds: null,
    result: {
      status: 'completed',
      workflowSlug: workflowSlug(input.mode),
      summary: `${modeLabel(input.mode)} mapped "${signal.slice(0, 92)}${signal.length > 92 ? '...' : ''}" into a ready operations workflow.`,
      confidence: isVoice ? 88 : isFile ? 84 : 91,
      extractedEntities: {
        primary_signal: isVoice ? 'voice_lead' : isFile ? 'file_or_image_intake' : 'workflow_request',
        source: input.fileName || (isVoice ? 'transcript' : 'text_prompt'),
        suggested_modules: isFile ? 'Intake, Extraction, Routing, CRM' : 'Inbox, Routing, Leads, Reporting',
        owner: isVoice ? 'sales_ops' : isFile ? 'operations' : 'support_ops',
      },
      decision: {
        route: isVoice ? 'lead_capture' : isFile ? 'intake_triage' : 'support_and_ops_routing',
        priority: isVoice ? 'high' : 'medium',
        handoffRequired: isVoice,
      },
      recommendedAction: 'Start a 14-day trial to save this preview, connect tools, and deploy the workflow.',
      executedActions: [],
      externalRefs: [],
      auditTrail: [
        'preview_input_received',
        'entities_extracted',
        'route_selected',
        'actions_prepared',
      ],
      observability: {
        providerRefs: [],
        latencyMs: 0,
        costEstimate: 0,
      },
    },
    meta: {
      source: 'landing_sandbox',
      mode: input.mode,
      locale: 'en',
      timestamp: new Date().toISOString(),
      limitState: 'ok',
    },
  };
}
