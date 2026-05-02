import type { LandingSandboxEnvelope, SandboxMode } from '@/lib/landing-sandbox/types';

export type LandingSandboxRuntimeMode = 'mock' | 'live';

export interface LandingSandboxPreviewRequest {
  mode: SandboxMode;
  prompt: string;
  transcript?: string;
  fileName?: string;
  locale: 'en' | 'ar';
  source: 'landing_sandbox';
}

export type LandingSandboxPreviewResponse = LandingSandboxEnvelope;

export interface LandingSandboxClient {
  runPreview(request: LandingSandboxPreviewRequest): Promise<LandingSandboxPreviewResponse>;
}

