import type { WorkflowAuditState } from '@/lib/types';
export type SandboxMode = 'workflow' | 'voice' | 'file';

export interface LandingSandboxInput {
  mode: SandboxMode;
  sessionId?: string;
  locale: 'en' | 'ar';
  prompt: string;
  transcript?: string;
  fileName?: string;
  source: 'landing_sandbox';
  file?: File | null;
}

export interface LandingSandboxDecision {
  route: string;
  priority: 'low' | 'medium' | 'high';
  handoffRequired: boolean;
}

export interface LandingSandboxResult extends WorkflowAuditState {
  status: 'completed' | 'needs_human' | 'failed';
  workflowSlug: string;
  summary: string;
  confidence: number;
  extractedEntities: Record<string, string | number | boolean | null>;
  decision: LandingSandboxDecision;
  recommendedAction: string;
}

export interface LandingSandboxEnvelope {
  ok: boolean;
  fallback: boolean;
  message: string;
  retryAfterSeconds: number | null;
  result: LandingSandboxResult;
  meta: {
    source: 'landing_sandbox';
    mode: SandboxMode;
    locale: 'en' | 'ar';
    timestamp: string;
    limitState: 'ok' | 'rate_limited';
    runtime?: 'mock' | 'live' | 'fallback';
    requestId?: string | null;
  };
}

export interface LandingSandboxContext {
  ip: string;
  userAgent: string;
}
