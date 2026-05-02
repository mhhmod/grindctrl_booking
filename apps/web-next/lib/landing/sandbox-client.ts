import { buildMockSandboxEnvelope } from '@/lib/landing/mock-sandbox-runner';
import type {
  LandingSandboxClient,
  LandingSandboxPreviewRequest,
  LandingSandboxPreviewResponse,
  LandingSandboxRuntimeMode,
} from '@/lib/landing/sandbox-contract';

const DEFAULT_SANDBOX_MODE: LandingSandboxRuntimeMode = 'mock';
type SandboxModeEnv = {
  LANDING_SANDBOX_MODE?: string;
};

function normalizeSandboxMode(value: string | undefined): LandingSandboxRuntimeMode {
  return value === 'live' ? 'live' : DEFAULT_SANDBOX_MODE;
}

export function getLandingSandboxMode(env?: SandboxModeEnv): LandingSandboxRuntimeMode {
  return normalizeSandboxMode(env?.LANDING_SANDBOX_MODE ?? process.env.LANDING_SANDBOX_MODE);
}

export const mockLandingSandboxClient: LandingSandboxClient = {
  async runPreview(request) {
    return buildMockSandboxEnvelope({
      mode: request.mode,
      prompt: request.prompt,
      transcript: request.transcript,
      fileName: request.fileName,
    });
  },
};

export const liveLandingSandboxClient: LandingSandboxClient = {
  async runPreview() {
    // TODO: Future connection point for the server route that will call n8n/Supabase.
    // Keep endpoint URLs and secrets server-only; do not add live workflow URLs here.
    throw new Error('Landing sandbox live mode is defined but not connected.');
  },
};

export async function runLandingSandboxPreview(
  request: LandingSandboxPreviewRequest,
  options: {
    env?: SandboxModeEnv;
    mockClient?: LandingSandboxClient;
    liveClient?: LandingSandboxClient;
  } = {},
): Promise<LandingSandboxPreviewResponse> {
  const mode = getLandingSandboxMode(options.env);
  const mockClient = options.mockClient ?? mockLandingSandboxClient;
  const liveClient = options.liveClient ?? liveLandingSandboxClient;

  if (mode === 'live') {
    return liveClient.runPreview(request);
  }

  return mockClient.runPreview(request);
}
