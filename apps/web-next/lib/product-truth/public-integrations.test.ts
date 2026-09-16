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
    expect(findPublicIntegration('claude')?.state).toBe('evidence-required');
  });

  it('never labels an evidence-free relationship as implemented or setup-ready', () => {
    for (const integration of PUBLIC_INTEGRATIONS.filter((item) => item.evidenceRef === null)) {
      expect(['implemented', 'setup-required']).not.toContain(integration.state);
    }
  });

  it('distinguishes infrastructure from a merchant integration', () => {
    expect(findPublicIntegration('supabase')?.state).toBe('infrastructure');
  });
});
