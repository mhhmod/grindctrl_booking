import { describe, expect, it } from 'vitest';
import {
  findPublicIntegration,
  PUBLIC_INTEGRATIONS,
  PUBLIC_INTEGRATION_STATES,
} from './public-integrations';

describe('public integration truth', () => {
  it('uses unique stable ids and an explicit relationship state', () => {
    const ids = PUBLIC_INTEGRATIONS.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const integration of PUBLIC_INTEGRATIONS) {
      expect(integration.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(PUBLIC_INTEGRATION_STATES).toContain(integration.state);
      expect(integration.note.length).toBeGreaterThan(0);
    }
  });

  it('does not present planned, credential-dependent, or evidence-free tools as implemented', () => {
    expect(findPublicIntegration('telegram')?.state).toBe('planned');
    expect(findPublicIntegration('zapier')?.state).toBe('planned');
    expect(findPublicIntegration('make')?.state).toBe('planned');
    expect(findPublicIntegration('notion')?.state).toBe('planned');
    expect(findPublicIntegration('whatsapp')?.state).toBe('evidence-required');
    expect(findPublicIntegration('instagram')?.state).toBe('evidence-required');
  });

  it('never labels an evidence-free relationship as implemented or setup-ready', () => {
    for (const integration of PUBLIC_INTEGRATIONS.filter((item) => item.evidenceRef === null)) {
      expect(['implemented', 'setup-required']).not.toContain(integration.state);
    }
  });

  it('distinguishes infrastructure from a merchant integration', () => {
    expect(findPublicIntegration('supabase')?.state).toBe('infrastructure');
    expect(findPublicIntegration('groq')?.state).toBe('infrastructure');
    expect(findPublicIntegration('openrouter')?.state).toBe('infrastructure');
  });

  it('lists the AI providers actually paid for and called, with real evidence refs', () => {
    // Groq (chat/STT/TTS) and OpenRouter (Try-On image generation, vision triage)
    // are the only two AI providers with a real API key, SDK/fetch call, and env
    // var in the codebase — see lib/assistant/groq-client.ts and
    // lib/try-on/image-runner.ts.
    expect(findPublicIntegration('groq')?.evidenceRef).toBeTruthy();
    expect(findPublicIntegration('openrouter')?.evidenceRef).toBeTruthy();
  });

  it('never lists a raw underlying AI model as a directly integrated provider', () => {
    // Gemini/Claude/OpenAI are only reachable indirectly, as swappable model
    // slugs passed through the Groq/OpenRouter infrastructure entries above —
    // they must never appear as their own register row or brand mark.
    for (const bannedId of ['gemini', 'claude', 'anthropic', 'openai', 'gpt']) {
      expect(findPublicIntegration(bannedId)).toBeUndefined();
    }
  });
});
