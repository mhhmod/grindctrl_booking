import type { LandingSandboxEnvelope, LandingSandboxInput } from '@/lib/landing-sandbox/types';

export type LandingSandboxClientInput = Omit<LandingSandboxInput, 'file'> & {
  fileName?: string;
};

export async function runLandingSandbox(input: LandingSandboxClientInput): Promise<LandingSandboxEnvelope> {
  const response = await fetch('/api/landing-sandbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Landing sandbox request failed.');
  }

  return response.json() as Promise<LandingSandboxEnvelope>;
}
